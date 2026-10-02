# Accessibilité : audit et propositions pour « Une année à la ferme »

*Analyse du 2 octobre 2026. Aucun fichier du projet n'a été modifié. Les scripts de mesure et les captures sont dans le scratchpad (`pw/`, `screens/a11y-*.png`).*

Public visé : joueurs occasionnels sur téléphone Android en portrait, y compris des personnes âgées ou qui ne jouent jamais, des daltoniens, des personnes qui ont du mal à lire (dyslexie, FALC), qui jouent d'une main ou qui supportent mal le mouvement.

---

## 1. Résumé

Le jeu part d'une bonne base : cibles tactiles ≥ 48 px partout (mesuré : **aucune cible trop petite** sur 10 écrans), textes à 14 px ou plus (deux exceptions à 12–13 px), mode **Détente** par défaut, tutoriel interactif qui met en pause, pause automatique sur les fenêtres et quand l'onglet est caché, sons toujours doublés d'un message écrit, volumes séparés, vibration réglable, option « Réduire les animations » qui suit aussi `prefers-reduced-motion`, `lang="fr"`, messages en `aria-live`, interrupteurs `role="switch"` avec `aria-checked`.

Les cinq problèmes qui pèsent le plus :

1. **La couleur porte seule des informations clés.** L'état du fermage (vert / orange / rouge) n'a ni icône ni mot, et le tutoriel l'enseigne par la couleur (« Vert : c'est couvert ; orange : récoltez encore ; rouge : danger ! »). Avec une deutéranopie ou une protanopie, vert et orange deviennent deux olives presque pareils. Le `aria-label` de la case ne donne pas non plus l'état. Le sol arrosé ou sec ne se distingue que par une teinte un peu plus sombre (rapport de luminance **1,36:1**), et une graine tout juste semée se voit à peine sur la terre.
2. **Contraste des boutons principaux.** Texte crème `#fff1d2` sur bouton rouge `#e2665b` : **2,99:1** ; sur bouton bois `#a3703a` : **3,8:1**. Le seuil AA est 4,5:1 pour du texte de 14–18 px. Le petit contour sombre du texte aide un peu, mais pas assez avec une police pixel fine. Cela touche *Commencer*, *C'est parti*, *Acheter*, *Ouvrir*, *Retour*, *Pause* (2,85:1), le bandeau vert (1,7 à 3,4:1 selon la scène derrière) et le texte « dans N j » en orange (4,32:1).
3. **La pression du temps n'est pas réglable vers le bas.** Un jour dure 20 s à ×1, et aucune vitesse plus lente n'existe. **Les feuilles du bas ne mettent pas le jeu en pause** (mesuré : vitesse 1 avec la feuille *Graines* ou *Acheter* ouverte), alors que la boutique compte environ 190 mots à lire et le Bilan environ 130. Les messages disparaissent après 2,2 à 7 s sans historique. Des joueurs l'ont déjà dit : « j'ai oublié d'appuyer sur pause, c'était déjà trop tard » (CARRIERE.md).
4. **Il manque des options d'affichage** : pas de taille de texte (la racine est fixée à `16px`, et `user-scalable=no, maximum-scale=1` bloque le zoom), pas de police plus lisible que la police pixel « Ferme », pas de mode contrasté ni de mode daltonien. Les cases à cocher des options sont **illisibles une fois cochées** : une petite croix pâle qui ressemble à « non ».
5. **« Réduire les animations » ne touche pas le canvas.** Les éclairs d'orage (voile blanc plein écran à 55 %, parfois deux éclairs à 0,18 s d'écart), la brume de chaleur qui ondule, les particules et les tremblements de sprites ne vérifient pas l'option (`src/render/effects.js`). Seuls le CSS et le défilement en tiennent compte.

---

## 2. Référentiels consultés (résumé utile pour ce jeu)

| Référentiel | Ce qu'on en retient ici |
|---|---|
| **Game Accessibility Guidelines** (basique / intermédiaire / avancé) | Basique : vitesse de jeu réglable, réglage des vibrations, cibles grandes et espacées, pas de clignotement, texte qu'on lit à son rythme, tutoriel interactif, langage simple, mise en forme simple, police lisible par défaut, bon contraste, **aucune info portée par la seule couleur**, **aucune info portée par le seul son**, volumes séparés, réglages mémorisés, accessibilité présentée dans le jeu, choix de difficulté. Intermédiaire et avancé : taille du texte, retour de navigation, rappel de l'objectif, aide contextuelle, lecture audio des menus, désactiver les effets de fond. |
| **Xbox Accessibility Guidelines (XAG 3.2)** | 101 taille et contraste du texte (4,5:1), 102 contraste des éléments, 103 autres canaux que la couleur, 104 sous-titres, 106 lecteur d'écran, 107 sous-titres et légendes, 108 mouvements et motifs (photosensibilité), 112 UI cohérente, 114 tutoriels et notifications, 116 durée des messages, 117 alertes par haptique et visuel. |
| **AbleGamers, APX et Includification** | Motifs « Slow It Down » (ralentir), « Distinguish This From That » (distinguer autrement que par la couleur), « Second Channel » (doubler les infos sur un 2e canal : son et vibration, texte), « Clear Text », « Total Recall » (rappel de l'objectif et de l'historique), « Undo Redo », « Helping Hand ». |
| **WCAG 2.2** (repère pour les parties HTML) | 1.4.1 Utilisation de la couleur ; 1.4.3 Contraste 4,5:1 / 3:1 pour le grand texte ; 1.4.11 Contraste des composants (3:1, ex. case cochée) ; 1.4.4 Redimensionner le texte jusqu'à 200 % ; 2.2.1 Délai réglable ; 2.2.2 Mettre en pause ; 2.3.1 Trois éclairs au plus par seconde ; 2.3.3 Animation déclenchée par une interaction ; 2.5.1 Gestes complexes avec une alternative simple ; 2.5.8 Taille des cibles (24 px minimum, le jeu vise 48). |
| **Android / Material, Apple HIG** | Cible 48 dp / 44 pt, respecter la taille de police système, ne pas bloquer le zoom, TalkBack ou VoiceOver sur des éléments natifs étiquetés, retours haptiques qui ont un sens (succès, erreur, alerte). |
| **Microsoft Inclusive Design** | Handicap permanent, temporaire ou de situation : une main occupée (on tient le téléphone d'une main dans les transports), soleil sur l'écran (contraste), son coupé (sous-titres et visuel). |
| **W3C COGA** (Making Content Usable) | Objectifs : aider à comprendre ce qu'il faut faire, éviter les pièges de temps, mots courants, aider à se concentrer, ne pas dépendre de la mémoire, permettre de revenir en arrière. |
| **FALC** (règles européennes, Inclusion Europe, Unapei) | Phrases courtes, une idée par phrase, mots de tous les jours (expliquer les mots difficiles), voix active, chiffres en chiffres, pas d'abréviation, illustrations qui aident, relecture par des personnes concernées. |
| **Dyslexie** (British Dyslexia Association) | Police sans empattement à formes bien distinctes, 12 à 14 pt ou plus, interligne 1,5, éviter le texte justifié, l'italique et les MAJUSCULES, fond crème plutôt que blanc (déjà le cas). |
| **Palettes pour daltoniens** | Okabe-Ito et palettes du même type (bleu / orange plutôt que vert / rouge), et surtout une **forme ou une icône** qui double chaque couleur. |

---

## 3. Méthode

- Lecture : `docs/MOBILE.md`, `docs/GAME_DESIGN.md`, `docs/CARRIERE.md`, `src/main.js` (réglages, pauses), `src/storage.js` (`DEFAULT_SETTINGS`), `src/ui/*` (options, feuilles, HUD, tutoriel, messages, gestes), `src/render/effects.js`, `src/audio/audio.js`, `css/style.css`.
- Playwright (Chromium, émulation **Pixel 7**, toucher seulement, `index.html?nosw&debug=1`) : 10 écrans audités (menu, options, début du niveau 1 avec tutoriel, graines ou défrichage, arrosage, champ avec plusieurs états, Acheter, Bilan, fiche du fermage, HUD vert / orange / rouge).
  - **Contraste** : couleur calculée de chaque texte comparée à la médiane du fond, mesurée sur une 2e capture où le texte est rendu transparent. Les faux positifs (textes cachés sous la barre d'onglets) ont été écartés.
  - **Cibles** : taille de chaque bouton, interrupteur, onglet ou ligne visible.
  - **Charge de lecture** : nombre de mots par feuille.
  - **Pause** : vitesse lue (`__game.state.speed`) quand chaque type de fenêtre est ouvert.
- Daltonisme simulé (matrices de Machado et al. 2009, sévérité 100 %) sur le HUD, le champ, la boutique, les options et le bilan.

Captures produites :

- `a11y-menu.png`, `a11y-options.png`, `a11y-jeu-tuto1.png`, `a11y-graines.png`, `a11y-arrose.png`, `a11y-champ-etats.png`, `a11y-champ-controle.png`, `a11y-acheter.png`, `a11y-bilan.png`, `a11y-fiche-fermage.png`
- HUD : `a11y-hud-ok.png`, `a11y-hud-warn.png`, `a11y-hud-danger.png`
- Daltonisme : **`a11y-cvd-hud.png`**, **`a11y-cvd-champ.png`**, `a11y-cvd-acheter.png`, `a11y-cvd-options.png`, `a11y-cvd-bilan.png`

---

## 4. Résultats détaillés

### 4.1 Vue : contraste et texte

| Élément | Couleurs | Rapport | Verdict |
|---|---|---|---|
| Texte de bouton rouge (*Commencer*, *C'est parti*, *Acheter 70*, *Ouvrir*, *Retour*) | `#fff1d2` / `#cf5e53` à `#e2665b` | 2,99 à 3,49 | ✗ AA (16–17 px) |
| Bouton *Pause* (HUD) | `#fff1d2` / `#e7695d` | **2,85** | ✗ |
| Texte de bouton bois (*Options*, *Crédits*, *Passer le tutoriel*, *Annuler*, ×1) | `#fff1d2` / `#a3703a` | 3,80 | ✗ pour 14–16 px |
| Titres en ruban (*Options*, logo) | crème / rouge | 2,99 | limite (22–28 px, seuil 3:1) |
| Bandeau vert « Première année · Ferme des Tilleuls… » | crème / herbe | **1,74 à 3,43** | ✗ : le ruban est en partie transparent et le fond change selon la scène |
| « dans N j » quand c'est juste (orange) | `#a56200` / parchemin | 4,32 | ✗ de justesse |
| « recommandé », badge « Détente » (13–14 px) | `#3f7a2a` / `#e3f3d6` | 4,48 | ✗ de justesse |
| Intertitre « En cas de problème » | `#3f2631` / rouge | 3,51 | ✗ |
| Chiffre qui s'envole « −4 » au-dessus de la maison | `#ffb0a6` / herbe | **1,42** | ✗ (décoratif, mais il donne une info) |
| Texte normal sur parchemin (`--text`, `--text-soft`) | | 6,3 à 12 | ✓ |

- **Tailles** : presque tout est à 14 px ou plus. Exceptions : `.tuto-name` « Joseph, votre voisin » à 12 px, `.diff-tag` à 13 px. L'argent est à 18–20 px ✓.
- **Police** : « Ferme » (Jersey 15 retouchée), une police pixel étroite. Elle est jolie et lisible pour un joueur habitué, mais plus dure pour la dyslexie, la presbytie et la basse vision : jambages courts, « il1 » et « rn/m » proches à 14 px. Aucune police de remplacement n'est proposée.
- **Taille réglable** : non. `html { font-size: 16px }` est fixé, et `maximum-scale=1, user-scalable=no` bloque le pincement. Sur Chrome Android, le réglage « Taille du texte / zoom de page » du système peut ne pas s'appliquer dans l'application installée. WCAG 1.4.4 n'est donc pas respecté, et rien ne le compense dans le jeu.
- **Cases à cocher des options** : cochée = petite croix beige pâle dans le cadre (`checkbox-on.png`), d'un contraste d'environ 1,3:1 avec le fond de la case. Cochée et décochée sont quasi impossibles à distinguer (voir `a11y-options.png`), et la croix se lit comme « non ». C'est contraire à WCAG 1.4.11.

### 4.2 Vue : informations portées par la seule couleur

| Signal | Comment il est montré | Daltonisme simulé (`a11y-cvd-*`) |
|---|---|---|
| **État du fermage** (couvert / à surveiller / danger) | Couleur du texte « dans N j » (vert ou orange), fin liseré doré pour l'orange, fond rouge pour le danger. `aria-label` identique dans les 3 cas : « Fermage : 60 pièces, dans 4 j ». | Deutéranopie et protanopie : vert et orange donnent **olive contre olive-jaune**. Le fond rouge du danger devient **le même kaki que le bouton Pause**. Tritanopie : correct. |
| **Bouton Pause rouge** à côté de la case fermage rouge | Le rouge veut dire à la fois « pause » et « danger » | Les deux se confondent |
| **Sol arrosé ou sec** | Terre plus sombre (`#d47250` contre `#ec8e65`, **1,36:1**) et gouttes pendant l'animation | La différence reste une simple nuance : difficile au soleil ou en basse vision |
| **Graine semée** (non mûre) | Quelques pixels sur la terre | Presque invisible pour tout le monde. On ne sait pas si on a semé. |
| **Culture mûre** | Grand pictogramme avec contour sombre ✓ | Distinct ✓ (forme) |
| Revenus et charges (boutique, bilan) | Couleur **et** signe +/− ✓ | OK |
| Difficulté choisie (Détente) | Fond vert, case cochée, mot « recommandé » | OK (case et texte) |
| Saisons (icônes) | Icône + nom ✓ | OK |

### 4.3 Moteur : toucher, une main, gestes

- Cibles : **toutes ≥ 48 × 48 px** ✓. Les parcelles font 2 × 2 tuiles ✓.
- Gestes : chaque geste a une alternative simple ✓. L'appui long ouvre la fiche, mais un 2e toucher l'ouvre aussi. Le glisser pour arroser en série a une alternative : toucher chaque parcelle. La feuille se ferme par glissement, par le ✕ ou par un toucher sur le fond.
- **Portée d'une main** : les onglets sont en bas ✓, mais la **vitesse et la pause sont en haut à droite** (la zone la plus dure à atteindre avec le pouce sur 6,3"), de même que le ✕ des feuilles et des fenêtres. *Menu → Pause* est en bas mais demande deux touchers. Aucune option pour gauchers ou pour une main.
- **Achats sans annulation** : *Acheter* débite tout de suite. Une erreur de toucher coûte cher au niveau 1.
- Vibrations : seulement sur les réussites (8 à 20 ms) et le prêt de Joseph. **Rien sur les erreurs ni sur les alertes de fermage.**

### 4.4 Cognition : temps, lecture, mémoire

- **Vitesse** : 1 jour = 20 s à ×1. Vitesses proposées : pause, ×1, ×2, ×4. **Pas de ×½.** La vitesse préférée est mémorisée.
- **Pauses automatiques** : fenêtres (`pauses: true`), étapes du tutoriel qui demandent une action ou une lecture (bienvenue, semer, arroser, fermage, hiver), conseils « première fois », onglet caché, téléphone tourné ✓. **Pas de pause pour les feuilles** (Acheter, Bilan, Graines, fiches) : mesuré ×1 pendant qu'elles sont ouvertes. Les étapes *Le temps passe*, *Récolter*, *Investir* et *À vous de jouer* ne mettent pas en pause.
- **Charge de lecture** : bulles du tutoriel de 15 à 35 mots (correct). Fiche du fermage : 56 mots, dont une formule (« Prévision = argent actuel + solde des matins à venir + cultures… »). Acheter : environ 190 mots. Bilan : environ 130 mots. Le vocabulaire est spécialisé : *fermage, charges, entretien, solde, investissements, défricher, prélevé*. C'est loin du FALC : phrases à deux propositions (« Achetés tôt, ils rapportent gros ; achetés tard, ils n'ont plus le temps de se rembourser »).
- **Messages** : 2,2 à 7 s, sans **historique** (sauf le journal de la carrière). Un message manqué est perdu (XAG 116, APX « Total Recall »).
- **Objectif visible** : le rappel compact du tutoriel existe ✓. Après le tutoriel, le « que faire maintenant ? » repose sur la couleur du fermage.

### 4.5 Mouvement et photosensibilité

- Option « Réduire les animations » et `prefers-reduced-motion` ✓ pour le CSS (`.reduced-motion *` : animations à 1 ms) et le défilement de la scène.
- **Pas d'effet sur le canvas** (`src/render/effects.js`) :
  - éclairs d'orage : voile blanc à 55 % sur tout l'écran, double éclair à 0,18 s dans 30 % des cas. Sous le seuil de 3 éclairs par seconde, mais c'est un déclencheur connu (XAG 108) ;
  - brume de chaleur : bandes décalées de ±1 px ;
  - particules (pièces, gouttes, confettis), tremblement de sprites.
- `.hud-bill.is-urgent` clignote sans fin (coupé si « animations réduites » ✓).
- La préférence système n'est lue qu'au démarrage (pas d'écouteur `change`). Défaut mineur.

### 4.6 Audition et haptique

- Chaque son important a son équivalent visuel : erreur → message, gel → message « Gel », annonce de saison → bandeau, aube → compteur de jour ✓. Pas de dialogue parlé, donc pas de sous-titres nécessaires ✓.
- Volumes séparés (musique, sons, ambiance) et « Couper tout le son » ✓.
- Haptique : un seul réglage (oui ou non), pas de motifs distincts pour succès, erreur et alerte.

### 4.7 Lecteurs d'écran (TalkBack)

- L'interface HTML (HUD, onglets, feuilles, fenêtres, options) est en vrais `<button>` avec des libellés ✓. Les fenêtres gèrent le focus ✓. Messages et bandeau en `aria-live="polite"` ✓.
- Le canvas a `aria-label="La ferme"`, sans aucune description de l'état du champ. Jouer en aveugle demanderait une vue « liste des parcelles » en HTML, ce qui est faisable mais coûteux. En revanche, **les libellés `aria-label` peuvent dire l'état** (fermage couvert ou non, vitesse) pour un coût quasi nul.
- `user-scalable=no` gêne aussi la loupe de TalkBack sur certains appareils.

### 4.8 Ce qui est déjà bien (à garder)

Mode Détente par défaut (pousse sans arrosage, prêt de Joseph), tutoriel interactif qu'on peut passer, conseils « première fois », pause automatique sur les fenêtres, sauvegarde automatique, cibles ≥ 48 px, onglets en bas avec icône et texte, raisons écrites des refus (« Il vous faut 40 pièces… »), signes +/− sur les montants, aucun son sans équivalent visuel, réglages mémorisés, fond crème (bon pour la dyslexie), pas de chrono punitif hors fermage.

---

## 5. Améliorations proposées, par priorité

Impact : ★★★ fort / ★★ moyen / ★ faible. Effort : S (moins d'une demi-journée), M (1 à 2 jours), L (plus).

### Priorité 1 : impact fort, effort faible (à faire d'abord)

| # | Amélioration | Impact | Effort | Où dans le code |
|---|---|---|---|---|
| 1 | **Doubler l'état du fermage par une icône et un mot.** ✓ « couvert », ! « juste », ✗ « danger » (ou « Joseph aide »). Mettre l'état dans `aria-label` (« …, couvert »). Changer le texte du tutoriel : « Une coche : c'est couvert. Un point d'exclamation : récoltez encore. » | ★★★ | S | `src/ui/hud.js` (`refresh`, l.364–369), `css/style.css` (`.hud-bill.is-*`), `src/ui/tutorial.js` (étape `bill`) |
| 2 | **Bouton Pause : ne plus utiliser le rouge.** Prendre l'ardoise ou le bleu (`--img-btn-slate`) avec l'icône ⏸ et le mot « Pause ». Le rouge reste réservé au danger. | ★★★ | S | `css/style.css` (`.hud-speed`, `#hud.is-paused`) |
| 3 | **Contraste des boutons** : passer le fond rouge au `--red-dark` (`#8e3f38`, 6,4:1 avec le crème) ou foncer le sprite du bouton. Ou, à l'inverse, texte foncé `--outline` sur rouge clair (4,1:1, encore court), donc fond foncé recommandé. Pour le bois : texte crème sur `--wood-dark` (`#6d4b27`, environ 7:1). Rendre le contour de texte plus épais (contour 4 directions au lieu d'une ombre de 1 px). | ★★★ | S–M | `css/style.css` (`.btn`, `.btn--red`, sprites `assets/sprites/ui/button-*.png`) |
| 4 | **Cases à cocher lisibles** : vraie coche ✓ foncée (`--green-dark` ou `--outline`) sur fond clair, ou interrupteur à curseur avec « Oui / Non » écrit, comme `.proc-switch`, qui l'affiche déjà. | ★★★ | S | `assets/sprites/ui/checkbox-on.png`, `css/style.css` l.1150–1158, `src/ui/dialogs.js` (`toggle`) |
| 5 | **Option « Pause quand une feuille est ouverte »**, activée par défaut en Détente. Elle utilise `app.pushPause('sheet')` à l'ouverture et `popPause('sheet')` à la fermeture. | ★★★ | S | `src/ui/sheets.js` (`open`/`close`), `src/storage.js` (`DEFAULT_SETTINGS`), `src/ui/dialogs.js` (options) |
| 6 | **Animations réduites dans le canvas** : sans éclair (ou un voile à 15 % sans double éclair), sans brume de chaleur, moitié moins de particules, sans tremblement. Passer `reducedMotion` à `createEffects` ou le lire dans `scene.js`. Écouter `matchMedia(...).addEventListener('change')`. | ★★ | S | `src/render/effects.js` (l.189, 776–782, 851, 1055, brume), `src/main.js` (`applyDisplaySettings`) |
| 7 | **Bandeau vert** : rendre le ruban opaque ou ajouter un fond sombre derrière le texte (au moins 4,5:1). Le texte « Niveau 1 · Détente · Printemps, jour 1 » passe aujourd'hui à 1,7:1 sur l'herbe claire. | ★★ | S | `css/style.css` (`.banner`, `.banner-text`) |
| 8 | **Petits contrastes à corriger** : `--warn` passe de `#a56200` à `#8a5200` environ (≥ 5:1) ; `.diff-tag` et `.mode-badge` vert sur vert clair ; intertitre sur rouge ; « −4 » qui s'envole avec un contour sombre ; `.tuto-name` et `.diff-tag` à 14 px. | ★★ | S | `css/style.css` (`:root`, `.money-pop`, `.diff-tag`, `.tuto-name`) |
| 9 | **Vibrations qui ont un sens** : erreur `[30,40,30]`, alerte de fermage à J-1 `[15,80,15,80,15]`, récolte `8`. Ajouter un réglage d'intensité (désactivé / léger / fort). | ★★ | S | `src/main.js` (`report()`, événement `seasonWarning`, `bill`) |

### Priorité 2 : impact fort, effort moyen

| # | Amélioration | Impact | Effort | Où |
|---|---|---|---|---|
| 10 | **Taille du texte réglable** (100 / 115 / 130 / 150 %) dans les options. Variable `--text-scale` appliquée à `html { font-size: calc(16px * var(--text-scale)) }`. Vérifier que le HUD sur 2 lignes et les feuilles tiennent à 360 px (tests Playwright existants). Retirer `maximum-scale=1` (garder `touch-action` pour empêcher le zoom involontaire sur le canvas). | ★★★ | M | `css/style.css` (racine, HUD), `src/main.js` (`applyDisplaySettings`), `src/index.template.html` (viewport) |
| 11 | **Police lisible au choix** : « Police du jeu (pixel) » ou « Police lisible ». Ajouter une police libre OFL comme Atkinson Hyperlegible (Braille Institute, OFL) ou Lexend, à lister dans `CREDITS.md`. Classe `html.font-readable`, interligne 1,4. | ★★★ | M | `css/fonts.css`, `css/style.css`, `assets/fonts/`, `CREDITS.md` |
| 12 | **Vitesse ×½** (1 jour = 40 s) et « Démarrer en pause chaque matin » (option). Les deux répondent au retour « c'était déjà trop tard ». `setSpeed(0.5)` doit être accepté par le cœur (`src/core`, tests) et par `loadSettings` (`[0.5,1,2,4]`). | ★★★ | M | `src/core/game.js` (`setSpeed`), `src/storage.js`, `src/ui/hud.js`, `tests/` |
| 13 | **Sol arrosé ou sec bien distinct** : contour bleu ou petites flaques sur la parcelle arrosée, et une **goutte barrée ou un pictogramme « soif »** au-dessus des parcelles à arroser (comme la bulle de la culture mûre). Une graine semée doit montrer une pousse lisible (2 à 3 feuilles vert foncé avec contour). | ★★★ | M | `src/render/scene.js`, `src/render/effects.js`, sprites des cultures (`assets/sprites/`) |
| 14 | **Historique des messages** : petite icône 🔔 dans le HUD ou le menu, qui garde les 30 derniers messages (gel, ventes, conseils). Toucher un message en cours le garde affiché. | ★★ | M | `src/ui/toasts.js` (tableau `history`), feuille dans `src/ui/sheets.js` |
| 15 | **Réécriture FALC** des textes du niveau 1 et du tutoriel : une idée par phrase, mots courants, un mot difficile expliqué la 1re fois (« Le **fermage**, c'est le loyer de la terre. »). Fiche du fermage : remplacer la formule par trois lignes avec icônes (« Argent maintenant 160 / Gagné d'ici là +12 / À payer 20 → ✓ ça passe »). Faire relire par deux ou trois joueurs non joueurs. | ★★★ | M | `src/ui/tutorial.js`, `src/ui/hud.js` (fiche), `src/ui/panel.js`, `src/ui/text.js` |
| 16 | **Annuler un achat** : un message « Poulailler acheté · Annuler » pendant 5 s (remboursement complet si rien n'a changé), ou une confirmation pour les achats de plus de 50 % de l'argent. | ★★ | M | `src/main.js` (`buyInvestment`), action de remboursement dans le cœur, tests |
| 17 | **Disposition pour une main ou pour gaucher** : option « Bouton de vitesse en bas » (dans la barre d'onglets, ou bouton flottant au-dessus des onglets du côté choisi). Pour tous, mettre « Pause » directement dans la barre d'onglets ou rendre *Menu* = pause immédiate. | ★★ | M | `src/ui/tabbar.js`, `src/ui/hud.js`, `css/style.css` |

### Priorité 3 : confort, inclusion avancée

| # | Amélioration | Impact | Effort | Où |
|---|---|---|---|---|
| 18 | **Mode « couleurs renforcées »** : palette inspirée d'Okabe-Ito pour les états (bleu = couvert, orange = juste, magenta foncé = danger), contours plus épais, sans fond d'herbe derrière le texte. Ce n'est pas un filtre daltonien sur tout l'écran, qui dénature le pixel art. | ★★ | M | `css/style.css` (`html.high-contrast`), couleurs d'état du canvas |
| 19 | **Section « Accessibilité » dans les options**, regroupant texte, police, contraste, animations, vitesse, pause des feuilles, vibrations, main. Proposer ces réglages **au premier lancement** (« Voulez-vous des textes plus grands ? »). Décrire ces fonctions sur la page du jeu (GAG : présenter l'accessibilité). | ★★ | S–M | `src/ui/dialogs.js` (`options`, 1er lancement) |
| 20 | **Lecteur d'écran** : `aria-label` complets (fermage + état, vitesse, culture de la parcelle touchée). Annonce `aria-live` du résumé de l'aube (« Jour 3. +7 pièces. 2 parcelles à arroser. 1 carotte mûre. »). Vue HTML optionnelle « liste des parcelles » (boutons « Parcelle 3 : carotte, à arroser ») pour jouer sans voir le canvas. | ★★ | M (annonces) / L (liste) | `src/ui/hud.js`, `src/main.js` (événement `dawn`), nouveau `src/ui/plotlist.js` |
| 21 | **Lecture à voix haute** des bulles de Joseph (`speechSynthesis`, voix fr-FR, option). Aide les faibles lecteurs et les enfants, sans fichier audio à ajouter. | ★★ | S–M | `src/ui/tutorial.js`, `src/ui/hints.js` |
| 22 | **Rappel de l'objectif** permanent après le tutoriel : une ligne dans la fiche argent ou fermage, « Prochain but : avoir 60 pièces avant le soir du jour 7 », et un petit « ? » qui rouvre la dernière bulle de Joseph. | ★★ | S | `src/ui/hud.js`, `src/ui/tutorial.js` |
| 23 | **Messages plus longs** : durée minimale calculée sur la longueur (environ 60 ms par caractère, 4 s au minimum), réglage « Messages : normaux / longs ». | ★ | S | `src/ui/toasts.js` |
| 24 | **Recueillir les retours d'accessibilité** : lien « Signaler une gêne » dans les options (GAG basique : demander des retours d'accessibilité). | ★ | S | `src/ui/dialogs.js` |

### Ordre conseillé

1. **Lot 1 (une journée)** : #1, #2, #4, #5, #6, #7, #8, #9. Coût faible, ça règle la couleur seule, le contraste des états, la pression du temps dans les feuilles et la photosensibilité.
2. **Lot 2** : #3 (boutons), #10 (taille du texte), #11 (police), #12 (×½), #13 (sol et pousses).
3. **Lot 3** : #15 (FALC), #14 (historique), #16 (annuler), #17 (une main), #19 (section Accessibilité).
4. **Ensuite** : #18, #20 à #24.

Pour chaque lot : ajouter aux tests Playwright existants une mesure automatique du **contraste** (même méthode que cet audit : `pw/run.js` + `pw/contrast.py`) et un contrôle « **aucun état porté par la seule couleur** » (le `aria-label` du fermage contient l'état). Tester à 360 × 740 avec le texte à 130 %.

---

## 6. Sources

- Game Accessibility Guidelines : https://gameaccessibilityguidelines.com/ (basique : https://gameaccessibilityguidelines.com/basic/, intermédiaire et avancé dans le même site)
- Xbox Accessibility Guidelines 3.2 : https://learn.microsoft.com/en-us/gaming/accessibility/guidelines (XAG 101, 102, 103, 108, 114, 116, 117)
- AbleGamers, Accessible Player Experiences (APX) : https://accessible.games/accessible-player-experiences/ ; Includification : https://accessible.games/includification/
- WCAG 2.2 (W3C) : https://www.w3.org/TR/WCAG22/ (1.4.1, 1.4.3, 1.4.4, 1.4.11, 2.2.1, 2.2.2, 2.3.1, 2.3.3, 2.5.1, 2.5.8)
- W3C COGA, Making Content Usable for People with Cognitive and Learning Disabilities : https://www.w3.org/TR/coga-usable/
- Android, accessibilité des applications : https://developer.android.com/guide/topics/ui/accessibility ; Material Design, accessibilité : https://m3.material.io/foundations/accessible-design/overview
- Apple Human Interface Guidelines, accessibilité : https://developer.apple.com/design/human-interface-guidelines/accessibility
- Microsoft Inclusive Design : https://inclusive.microsoft.design/
- Unapei, liste de vérification FALC : https://www.unapei.org/document/explication-liste-verification-falc/ ; Inclusion Europe, Easy-to-read : https://www.inclusion-europe.eu/easy-to-read/ ; fiche FALC du ministère de la Santé : https://sante.gouv.fr/IMG/pdf/fichetranscriptionfalc_web.pdf
- British Dyslexia Association, Dyslexia Style Guide : https://www.bdadyslexia.org.uk/advice/employers/creating-a-dyslexia-friendly-workplace/dyslexia-friendly-style-guide
- Palette Okabe-Ito (Color Universal Design) : https://jfly.uni-koeln.de/color/
- Machado, Oliveira, Fernandes (2009), *A Physiologically-based Model for Simulation of Color Vision Deficiency* (matrices utilisées pour la simulation)
- Atkinson Hyperlegible (Braille Institute, OFL) : https://www.brailleinstitute.org/freefont/
- Canvas et lecteurs d'écran, régions `aria-live` : https://ianeress.substack.com/p/aria-for-web-games-november-13-2024 ; https://bugnet.io/blog/how-to-fix-web-game-canvas-no-screen-reader-announcements ; TalkBack sur le Web : https://tpgi.com/accessibility-testing-with-android-talkback
