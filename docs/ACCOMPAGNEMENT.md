# L'accompagnement — Joseph vous montre (conception, 2026-10-04)

Demande de l'utilisateur : « Je voudrais que tout au long du jeu le joueur soit accompagné pour l'aider. Au début du jeu
pour apprendre les rudiments, et ensuite à chaque nouvelle mécanique pour ne pas oublier de choses. »

Ses décisions :

1. **Le guide, c'est Joseph, le voisin** : une petite bulle avec son portrait ; il **montre du doigt** où toucher ; textes courts.
2. **Montrer, puis rappeler** : chaque nouvelle mécanique est **montrée une fois, pas à pas, au moment où elle arrive** ;
   ensuite, **rappels discrets** si le joueur oublie (champs mûrs, troc qui attend…). Réglage **« Accompagnement :
   Complet / Discret / Aucun »**.
3. **Un vrai tutoriel en jouant au début de la carrière** : premières minutes guidées pas à pas sur de **vraies parcelles
   mûres** (récolter en glissant, semer, arroser, vendre, premier achat), très peu de texte, passable.

Ce document est la conception (aucun code du jeu n'est écrit ici). Contrats de code : `docs/ARCHITECTURE.md`,
« Accompagnement — contrats ». Liens : `docs/analyse/0-SYNTHESE.md` (problèmes 4 et 5 ; idées E1, E3, E4, E5, A10),
`docs/analyse/4-accessibilite.md` (§ 4.4, recommandations 15, 20, 21, 22), `docs/MOBILE.md`, `docs/CARRIERE.md`,
`docs/GAME_DESIGN.md`, `docs/VALLEE.md`.

---

## 0. En bref

**Une seule voix, un seul moteur.** Aujourd'hui, le joueur est guidé par cinq systèmes qui ne se parlent pas : le tutoriel
du niveau 1 (`tutorial.js`), une soixantaine de conseils « première fois » dispersés dans six fichiers (`hints.js` et des
tables recopiées dans `variety.js`, `cozy.js`, `valley.js`, `heritage.js`, `places.js`), les trois bulles d'accueil de la
carrière (`windows.js`), le conseil « fermage en danger » (`main.js`) et l'astuce du bilan de saison (`dialogs.js`).
Ils deviennent **un moteur de leçons** (`src/ui/coach/`) et **un catalogue** : une leçon par mécanique, montrée par Joseph.

**Trois gestes du moteur** :

| Geste | Quand | Forme |
|---|---|---|
| **Montrer** (leçon) | la première fois qu'une mécanique compte pour le joueur | bulle de Joseph (≤ 2 lignes) + **doigt animé** sur la cible (bouton, parcelle, bâtiment, bête…) ; le temps s'arrête pendant l'étape ; l'étape avance quand le joueur **fait** le geste |
| **Rappeler** (rappel) | quand une chose utile attend depuis un moment (champs mûrs, troc, bête à voir…) | une **pastille** de Joseph, petite, sans pause, qui pointe la ligne « À faire » ; jamais culpabilisant, jamais deux fois de suite |
| **Garder** (carnet) | toujours | **Le carnet de Joseph** : toutes les leçons vues, relisibles et rejouables |

**Ce qui change pour le joueur** :

- **Niveaux** : le tutoriel du niveau 1 passe de 206 à ≈ 90 mots, apprend enfin les glissés, l'appui long, la ligne
  « À faire » et « Semer partout » ; chaque niveau suivant présente sa contrainte en une leçon.
- **Carrière** : la ferme commence avec **6 carottes mûres** ; le premier glissé de récolte arrive en 5 secondes ; puis
  semer, arroser, le temps, ramasser les œufs, acheter une poule ; ensuite **chaque rang** met en avant 3 nouveautés
  (au lieu de 21 d'un coup) et chaque nouveauté est montrée quand elle devient utile.
- **Plus tard** : surprises, village, fêtes, hiver, Vallée (V1 → V3) : une leçon courte au bon moment, puis des rappels doux.

**Parité du mode Classique intacte** : l'accompagnement est **purement de l'interface**. Il ne lit le jeu que par
`game.state`, `game.query` et les événements, n'appelle aucune action de jeu (sauf la pause, comme le tutoriel et les
conseils d'aujourd'hui) et ne garde **rien** dans l'état de partie : les leçons vues vont dans la progression (`hintsSeen`,
déjà là), les réglages dans les options. **Une seule exception, à trancher** (§ 15, point 1) : les 6 carottes mûres du
début de carrière demandent une option de création de carrière dans le cœur (`createCareer({ starter: true })`), qui ne
touche ni les niveaux, ni la simulation (désactivée par défaut côté cœur).

---

## 1. Ce qui existe aujourd'hui (inventaire du guidage)

| Système | Fichier | Ce qu'il fait | Devenir |
|---|---|---|---|
| Tutoriel du niveau 1 | `src/ui/tutorial.js` (648 lignes) | 11 étapes (bienvenue, semer, arroser, vitesse, récolter, fermage, poulailler, « à vous », attente de l'hiver, hiver, fin) ; bulle ancrée haut/bas, anneau DOM sur la parcelle, rappel compact (« pill »), pause `tutorial`, reprise par `storage.loadTutorial()` (`{ done, step }`) | **Remplacé** par le cours `levels.firstYear` du moteur (§ 6). Le placement de la bulle (`positionPortrait`, `positionWide`, `placePill`, défilement au grand texte) **est repris** dans `src/ui/coach/bubble.js`. |
| Conseils « première fois » | `src/ui/hints.js` + tables `DEFAULT_HINTS` (`variety.js`, `cozy.js`), `VALLEY_HINTS`, `HERITAGE_HINTS`, `PLACES_HINTS`, `VARIETY_HINTS`, `COZY_HINTS` (données) | une bulle « Compris », pause `hint`, file, une bulle par ouverture de feuille, `relevant(app)`, mémoire `progression.hintsSeen` ; ≈ 60 identifiants (liste ci-dessous) | **Remplacés** par des leçons du catalogue (§ 7), **avec les mêmes identifiants** (ce qui a été vu reste vu). `app.hints.maybe(id, target)` reste un **pont** vers `app.coach.request(id, …)` le temps de la migration, puis disparaît. Les tables `*_HINTS` des données sont retirées par les paquets LEÇONS (tests mis à jour). |
| Accueil de la carrière | `src/ui/career/windows.js` `intro()` | fenêtre « Bienvenue ! » : 3 bulles de Joseph (forêt à vendre, charges, deux poules) | **Remplacé** par le tutoriel de début de carrière (§ 5) ; ses trois idées deviennent les leçons `career.lotForSale`, `career.charges`, `career.collect`. |
| Conseil « fermage en danger » | `src/main.js` `maybeLowMoneyHint()` | message important, une fois par saison, 3 jours avant un fermage mal parti | **Devient** le rappel `money.low` (§ 8), même règle, même texte, voix de Joseph. |
| Astuce du bilan de saison | `src/ui/dialogs.js` (fin de saison, `p.end-tip`) | une phrase selon la saison écoulée | **Gardée** (c'est le contenu du bilan) ; elle reçoit le portrait de Joseph et un lien « Revoir avec Joseph » vers la leçon concernée (pas de doublon : le bilan ne rejoue rien tout seul). |
| Ligne « À faire » | `src/ui/todo.js`, `todo-group.js` | la chose la plus utile, regroupée par famille (≤ 5 entrées) | **Gardée** : c'est le support des rappels. Le moteur lui **fournit** des entrées (rappels qui n'y sont pas encore) et peut la **pointer** ; il n'en duplique aucune. |
| Résumé du matin | `src/ui/todo.js` | « Bonjour ! Jour N. Hier : +46. Aujourd'hui : … » | **Gardé** ; un rappel dû à l'aube y prend une ligne « Joseph : … » (une au plus) au lieu d'une pastille. |
| Messages | `src/ui/toasts.js`, `messages.js` | important / info, historique, cloche | **Gardés** ; aucune leçon ni aucun rappel ne passe par un message (le moteur a sa bulle), sauf la note du carnet (« Nouvelle page dans le carnet de Joseph », info). |
| Guide de la ferme | `src/ui/guide.js` | sections repliables, glossaire « mots de la ferme », section « Les conseils de Joseph » (liste des `HINTS`) | **Fusionné** dans le carnet de Joseph (§ 9, point 2 du § 15) : la section « conseils » disparaît (remplacée par les leçons), le reste devient les onglets « Mots » et « Règles » du carnet. |
| « Où en étais-je ? » | `src/ui/todo.js` `showResume()` | fenêtre de reprise | **Gardée** ; le moteur ne montre rien avant qu'elle soit fermée. |
| Prochain indice de la Vallée | fiche « La Vallée » (`V(g).hint`) | le prochain but de la Vallée | **Gardé** (c'est du contenu) ; la leçon `valley.sheet` le montre une fois du doigt. |
| Récits et chapitres de Joseph | fenêtres de la Vallée, veillées | histoire | **Gardés** : ce n'est pas de l'accompagnement (ils restent visibles même avec « Aucun »). |

**Conseils existants** (identifiants gardés tels quels comme identifiants de leçons) :
`processing`, `processingBought`, `tree`, `goat`, `pollination`, `contest`, `grange`, `decor` ;
`career.start`, `career.collect`, `career.lotForSale`, `career.plan`, `career.hire`, `career.leave`, `career.collectAll`,
`career.machine`, `career.storage`, `career.quest`, `career.crows`, `career.yearEnd`, `career.theme` ;
`variety.board`, `variety.cart`, `variety.cards`, `variety.challenges`, `variety.merchant`, `variety.rare` ;
`cozy.album`, `cozy.fete`, `cozy.winter`, `cozy.lanterns`, `cozy.helpers`, `cozy.seedFair` ;
`valley.box`, `valley.jar`, `valley.trial`, `valley.nature`, `valley.species`, `valley.fixed`, `valley.fallow`,
`valley.stage`, `valley.library`, `valley.troc`, `valley.pair`, `valley.cross`, `valley.scented`, `valley.view`,
`valley.works`, `valley.valleyAnimal`, `valley.river`, `valley.wild`.

**Ce qui manque aujourd'hui** (analyse et lecture du code) : aucun apprentissage du glissé en carrière ; les gestes
« appui long », « Semer partout », « pincer pour zoomer », « Tout ramasser », la cloche, la ligne « À faire » ne sont
montrés nulle part ; 21 déblocages d'un coup au passage de rang ; les conseils sont des phrases sans geste (« ouvrez
l'onglet… ») qui ne montrent pas **où** toucher ; aucun rappel (sauf le fermage) ; rien ne se relit sauf la liste brute
du guide ; aucune différence entre un nouveau joueur et un joueur qui connaît.

---

## 2. Toutes les mécaniques et le moment où elles arrivent

Repère de lecture : **N** = mode Niveaux, **C** = carrière. « Détente / Classique » : mode de difficulté. La colonne
« Leçon » renvoie au catalogue (§ 7).

### 2.1 Mode Niveaux

| Moment | Mécanique | Leçon |
|---|---|---|
| Niveau 1, jour 1 | semer, arroser (toucher, glisser), le temps (vitesse, pause), récolter (toucher, glisser), argent payé tout de suite, fermage (signe ✓ ! ✗), acheter (poulailler), appui long = fiche, ligne « À faire », « Semer partout » | cours `levels.firstYear` (§ 6) |
| Niveau 1, jour 5 (Détente) | tableau du village | `variety.board` |
| Niveau 1, fin du printemps (Détente) | cadeau de saison (2 cartes), défis de l'été | `variety.cards`, `variety.challenges` |
| Niveau 1, été (Détente) | charrette, Basile, graines rares, fête du village (soupe) | `variety.cart`, `variety.merchant`, `variety.rare`, `cozy.fete`, `fete.marmite` |
| Avant l'hiver | gel, cultures d'hiver | `basics.frost` |
| Hiver (Détente) | lisière, mangeoire, veillée de Joseph | `cozy.winter`, `winter.feeder`, `winter.veillee` |
| Fin d'année (Détente) | lanternes | `cozy.lanterns` |
| Soir d'un fermage impayable (Détente) | prêt de Joseph, remboursement | `levels.loan` |
| Fin d'un niveau | étoiles, écus, grange, bonus, décoration, succès | `grange`, `decor`, `menu.achievements` |
| N'importe quand (Détente) | surprises de l'aube, qualité, géants, météos spéciales, vœu, champignons | `surprise.*`, `weather.*` |
| N'importe quand (les deux modes) | album | `cozy.album` |
| Niveau 2 | arrosage payant, canicules | `levels.drought` |
| Niveau 3 | maladie par temps de pluie | `levels.rot` |
| Niveau 4 | petit lopin, miser sur les animaux | `levels.smallPlot` |
| Niveau 5 | hiver de 14 jours | `levels.longWinter` |
| Niveau 6 | marché fou (cours chaque jour) | `levels.market` |
| Niveau 7 | prêt : mensualités | `levels.credit` |
| Niveau 8 | pas d'arrosage automatique, sol fatigué | `levels.fatigue` |
| Niveau 9 | ateliers (confitures), récoltes brutes −25 % | `processing`, `processingBought` |
| Niveau 9 → 12 | pommier | `tree` |
| Niveau 10 | pollinisation (ruche), 4 pommiers | `pollination` |
| Niveaux 10 → 12 | chèvres, fromagerie | `goat` |
| Niveau 11 | saisons 7-5-7-10, montagne, chambre d'hôte | `levels.mountain` |
| Niveau 12 | concours du village | `contest` |
| Achats ponctuels | arrosage automatique, mouton (tonte), ruche, panneau solaire, étal | `levels.sprinkler`, `levels.sheep` (les autres : texte de la carte d'achat) |

### 2.2 Carrière — du rang 1 au Domaine

| Rang / moment | Mécanique | Leçon |
|---|---|---|
| Création | nom, difficulté ; Ma ferme et Les niveaux | `menu.career` |
| Rang 1, minute 1 | récolter en glissant, semer, arroser, le temps, payé tout de suite, ramasser les œufs, acheter une poule | cours `career.firstSteps` (§ 5) |
| Rang 1, jours 2-7 | Carnet et objectifs du rang, charges de saison, ligne « À faire », appui long, « Semer partout », cloche | `career.start`, `career.charges`, `basics.todo`, `basics.longPress`, `basics.sowAll`, `basics.messages` |
| Rang 1 | terrain à vendre (carte 2D, mini-carte, grande carte), aménager un champ ou un pré, plan de culture, pincer pour zoomer | `career.lotForSale`, `career.map`, `career.develop`, `career.plan`, `basics.zoom` |
| Rang 1 | abris sur un pré (bergerie, chèvrerie), poulailler plein, Tout ramasser | `career.shelter`, `career.collectAll` |
| Rang 1 | étal, ruches, panneaux solaires | `career.stand`, `career.beehive` (panneaux : texte de la carte) |
| Rang 1 | prime « cueilli main » (+25 %), l'équipe attend 3-4 aubes (aider sans remplacer) | `cozy.helpers` |
| Rang 1 | événements au hasard : visiteur acheteur (offre), corbeaux, arc-en-ciel, rosée, touristes, cadeau de Joseph, animal perdu | `career.offer`, `career.crows` (les autres : message seulement) |
| Rang 1 | fêtes du calendrier (chasse aux œufs, soupe, stand, paniers de Noël), foire aux graines | `cozy.fete`, `fete.*`, `cozy.seedFair` |
| Rang 1 | trouvailles au défrichage | `career.finds` |
| Rang 1 | Joseph dépanne, coup dur, vente de secours (Détente) ; faillite (Classique) | `career.loan`, `career.hardship` |
| Fin de l'an 1 | bilan de l'année, année suivante, lanternes | `career.yearEnd`, `cozy.lanterns` |
| Dès l'été de l'an 1 | tableau, charrette, cadeau de saison, défis, Basile | `variety.*` |
| An 2 | années à thème (vedette, fête, visiteur) | `career.theme` |
| **Rang 2** (fenêtre « Nouveau rang ») | 3 nouveautés mises en avant | `career.rank2` |
| Rang 2 | maison niv. 2 → embauche, affectation, salaire, congés d'hiver | `career.hire`, `career.assign`, `career.leave` |
| Rang 2 | grenier (mise en réserve, vendre au bon cours) | `career.storage` |
| Rang 2 | arroseurs (machine, interrupteur, entretien) | `career.machine` |
| Rang 2 | verger, cour des ateliers, atelier de confitures | `career.orchard`, `career.workshop` |
| Rang 2 | serre (lot 4 : rang 2) | `career.greenhouse` |
| Rang 2 | quêtes de Joseph, amitié (♥) | `career.quest`, `career.hearts` |
| Rang 2 | comice agricole (été → automne) | `career.contest` |
| Rang 2 | **La Vallée** commence (boîte en fer) | `valley.box` → § 2.3 |
| **Rang 3** | semoir et moissonneuse (cheval ou tracteur), cueilleuse, collecteur | `career.rank3`, `career.traction`, `career.machine` |
| Rang 3 | porcherie (truffes), clapier (naissances), écurie (balades), chambre d'hôte | `career.animals3`, `career.guestHouse` |
| Rang 3 | mare, canards, pêche (lot 4 : rang 3) | `career.pond` |
| Rang 3 | fromagerie, moulin | `career.workshop` (rejouée pour un nouvel atelier : non ; texte de la carte) |
| Rang 3 + Vallée | panneau « Ici, une grainothèque ? » | `valley.librarySign` |
| **Rang 4** | tracteur, machines niv. 2, silo, étal niv. 2, conserverie, filature, ateliers niv. 4 | `career.rank4`, `career.tractor` |
| Rang 4 | humeur des employés (Las → congé, fête), niveaux des employés | `career.mood` |
| **Rang 5** | manoir, grand silo, château d'eau, convoyeur, marché fermier, embellissements (attrait, touristes) | `career.rank5`, `career.attraction` |
| **Rang 6** | Domaine : 16 terrains, comice régional, jeu libre | `career.rank6` |
| Après le 16ᵉ terrain + vue de la vallée | terres sauvages | `valley.wild` |

### 2.3 La Vallée (carrière, V1 → V3)

| Moment | Mécanique | Leçon |
|---|---|---|
| Rang 2 (1ʳᵉ aube) | boîte en fer, fiche « La Vallée » (segments, prochain indice), haie offerte | `valley.box`, `valley.sheet` |
| Bocal trouvé (défrichage, Basile, foire, geai) | ouvrir un bocal | `valley.jar` |
| Première graine ancienne semée | planche d'essai (récolter **à la main** : + 2 graines) | `valley.trial` |
| Variété fixée | graines illimitées, l'équipe peut la semer, traits en picto + mot | `valley.fixed`, `valley.traits` |
| Premier aménagement possible | mode aménagement (emplacements qui pulsent) | `valley.nature` |
| Première recette presque remplie | recettes d'habitat | `valley.recipe` |
| Première bête annoncée / venue | indice la veille ; toucher la bête pour qu'elle s'installe | `valley.speciesHint`, `valley.species` |
| Parcelle vide d'un champ | jachère fleurie, sol reposé | `valley.fallow` |
| Étape 2 | cueillette des haies | `valley.hedge` |
| Chaque étape | étapes de la vallée, chapitre de Joseph | `valley.stage` |
| Réaménager un terrain | aménagements « à replacer » | `valley.reserve` |
| Foire aux graines | étal « La grainothèque du pays » | `valley.fair` |
| V2, rang 3 | Grainothèque (panneau, construction, 5 niveaux) | `valley.librarySign`, `valley.library` |
| V2 | troc de saison avec les voisins | `valley.troc` |
| V2 | semer la paire, rencontres, croisement au nom de la ferme | `valley.pair`, `valley.cross` |
| V2 | trait Parfumée ; « Revoir la boîte » | `valley.scented`, `valley.revisitBox` |
| V3, étape 5 | poteau « Vers la vallée », vue de la vallée | `valley.viewOpen`, `valley.view` |
| V3 | fiche d'un lieu (✓ / ✗), chantier, reprise en saisons | `valley.place`, `valley.works` |
| V3 | bêtes de la vallée (carnet d'Hélène) | `valley.valleyAnimal` |
| V3 | pêche au ruisseau, champignons du bois | `valley.river`, `valley.mushrooms` |
| V3 | verger conservatoire : greffons (cerisier, poirier, reinette) | `valley.grafts` |
| V3, 16 terrains | terres sauvages (bois, marais, prairie) | `valley.wild` |
| V3 | étapes 6 et 7 | `valley.stage` (même leçon, pas rejouée) |
| V4 | *(en conception par un autre agent, `docs/VALLEE.md` § 11.4)* | une leçon par mécanique du V4, selon le modèle du § 7.8 |

---

## 3. Règles d'or de l'accompagnement

1. **Joseph, toujours** : portrait, nom « Joseph », voix chaleureuse, **vouvoiement** (comme toute l'interface ; ses
   récits gardent leur tutoiement). Jamais « Conseil » anonyme.
2. **Montrer où toucher** : chaque étape a une **cible** (élément de l'interface ou objet de la scène) et un **geste
   montré** (toucher, glisser, appui long, pincer, regarder). Une étape sans cible est l'exception (bienvenue, fin).
3. **Apprendre en faisant** : une étape qui demande un geste **avance quand le joueur fait le geste** (vrai événement du
   jeu), pas quand il touche « Suivant ». Les étapes de lecture ont un bouton (« Compris », « Suivant »), jamais un minuteur.
4. **Très peu de texte (FALC)** : **≤ 2 lignes par étape** au texte normal (≤ 90 caractères), une idée par phrase,
   ≤ 12 mots par phrase, mots de tous les jours, chiffres en chiffres, un mot difficile expliqué la première fois
   (« Le fermage, c'est le loyer de la ferme. »), voix active, impératif doux (« Glissez », « Touchez »).
5. **Une leçon à la fois**, et **jamais au mauvais moment** : ni pendant une fenêtre, une fête, la vue de la vallée, le
   mode décoration, un mode de visée (aménagement, terres sauvages), ni dans les 3 premières secondes d'une partie, ni
   pendant « Où en étais-je ? » — **sauf si la leçon concerne justement cet écran**.
6. **Le temps s'arrête pendant qu'on apprend** (étapes de lecture et de visée) ; il repart quand l'étape demande
   d'attendre (pousse, jour suivant). Le joueur peut toujours relancer le temps lui-même.
7. **Tout est passable** : « Passer » sur chaque bulle (une étape), « Plus tard » (la leçon revient au prochain bon
   moment, une fois), « Je connais » sur les cours ; rien n'est obligatoire, rien ne bloque le jeu.
8. **Rappeler sans culpabiliser** : jamais « vous avez oublié », jamais de perte chiffrée, jamais de rouge, jamais de
   compte à rebours ; toujours « quand vous voulez », « rien ne presse » ; un rappel ignoré trois fois se tait pour la
   saison ; chaque sorte de rappel se coupe dans le carnet.
9. **Une mécanique = une leçon**, quel que soit le mode : un geste appris au niveau 1 n'est pas réappris en carrière.
10. **Hors de la partie** : aucune donnée dans `game.state`, aucun tirage, aucune action de jeu (sauf la pause, déjà
    utilisée par le tutoriel et les conseils). Classique : parité 400 / 400, simulations identiques octet pour octet.
11. **Téléphone d'abord** : bulle pleine largeur en portrait, en haut ou en bas, **jamais sur sa cible** ; boutons
    ≥ 48 px dans le tiers bas quand la bulle est en bas ; cibles de la scène ≥ 48 px CSS au zoom courant (la scène
    zoome ou défile pour les montrer).

---

## 4. Le moteur de leçons

### 4.1 Les mots du moteur

| Mot | Définition |
|---|---|
| **Leçon** | une mécanique montrée une fois : identifiant, chapitre du carnet, déclencheur, étapes, condition « déjà su ». |
| **Étape** | une bulle de Joseph : texte (≤ 2 lignes), cible, geste montré, condition de réussite, pause ou non. |
| **Cours** | une suite de leçons jouées d'affilée (tutoriel de début de carrière, tutoriel du niveau 1). Le cours marque comme vues les leçons qu'il contient. |
| **Cible** | ce que Joseph montre : un élément de l'interface (sélecteur), une parcelle, plusieurs parcelles (chemin du glissé), un objet de la scène (même forme que `scene.hitTest`), un rectangle du monde, un objet de la vue de la vallée. |
| **Geste montré** | `tap` (toucher), `swipe` (glisser le long d'un chemin), `press` (appui long), `pinch` (pincer), `look` (regarder, anneau seul). |
| **Réussite** | un événement du jeu (`harvested` par le joueur…), un signal d'interface (feuille ouverte, onglet touché), un état (`plus aucune parcelle mûre`), ou un bouton de lecture. |
| **Rappel** | une chose utile qui attend ; jamais une leçon (pas de pas à pas) ; voir § 8. |

### 4.2 Cycle de vie d'une leçon

```
  inconnue ──déclencheur vrai──▶ en attente (file) ──bon moment──▶ montrée (étape 1…n) ──dernière étape réussie──▶ vue ✓
     │                                 │                               │  └─ « Passer » (toute la leçon) ──▶ vue ✓ (carnet : « passée »)
     │                                 │                               └──── « Plus tard » ──▶ en attente (une seule fois), puis vue
     └── « déjà su » vrai (ancienne partie, sujet réglé) ──▶ vue ✓ sans être montrée (carnet : « à relire »)
```

- **Déclencheur** : `on` (types d'événements du jeu ou signaux d'interface) **et/ou** `when(ctx)` (état), évalué à chaque
  événement concerné et au plus 2 fois par seconde pour les états. Une leçon déclenchée entre dans la file ; elle n'est
  pas oubliée si le moment n'est pas bon (elle attend), mais elle est **retirée** de la file si son déclencheur redevient
  faux avant d'être montrée (`stillRelevant(ctx)`, comme `relevant` aujourd'hui : « L'embauche » alors qu'un employé est
  déjà embauché → comptée comme vue, jamais montrée).
- **Déjà su** (`acquired(ctx)`) : le joueur maîtrise déjà (ancienne partie, sujet réglé). Voir § 10.3.
- **Vue** : identifiant ajouté à `progression.hintsSeen` (déjà en place, partagé par les deux modes, effacé par
  « Effacer la progression »). Une leçon vue n'est plus jamais montrée d'elle-même ; elle se rejoue depuis le carnet.

### 4.3 La file, les priorités, le rythme

- **Une seule leçon montrée à la fois.** Les autres attendent dans la file, triées par **priorité** puis par heure de
  déclenchement : cours 100 · sécurité (gel, charges, coup dur) 90 · leçons essentielles 70 · leçons utiles 40 ·
  méta (grange, décor, album) 20.
- **Respiration** : au moins **20 s réelles** entre la fin d'une leçon et le début de la suivante (sauf leçons chaînées
  d'un cours ou `next` explicite) ; au plus **3 leçons par jour de jeu** hors cours (les autres attendent l'aube suivante).
  Au passage de rang : la leçon du rang d'abord, les leçons de ses nouveautés seulement quand elles deviennent utiles.
- **Bon moment** (`contextOk`) : partie en cours (`status === 'playing'`), pas au menu (sauf `where: 'menu'`), aucune
  fenêtre ouverte (sauf `where: 'dialog:<id>'`), pas en mode fête (sauf `where: 'fete'`), pas dans la vue de la vallée
  (sauf `where: 'view'`), pas en décoration, pas en mode de visée (aménagement, terres sauvages ; sauf `where:
  'placing'`), pas le téléphone tourné, pas pendant « Où en étais-je ? », pas dans les 3 s après le début ou la reprise.
  **Feuille ouverte (téléphone)** : seule une étape dont la cible est **dans** cette feuille peut s'afficher (règle de
  `hints.js`), et une seule bulle par ouverture de feuille (`sheets.openCount`).
- **Interruption** : une fenêtre qui s'ouvre au milieu d'une étape la **suspend** (bulle cachée, étape gardée) ; elle
  reprend à la fermeture. Une feuille qui se ferme alors que l'étape visait son contenu ramène à l'étape d'ancrage
  (`back`, ex. « Touchez une parcelle vide » si la feuille des graines est fermée sans semer).
- **Patience** : une étape qui attend un geste n'a pas de minuteur ; après **15 s sans geste**, le doigt rejoue son
  geste (« Comme ça ! ») ; après **45 s**, la bulle se réduit en pastille (rappel compact, comme aujourd'hui) ; une étape
  sans pause ignorée pendant **2 jours de jeu** range la leçon dans le carnet (« à finir ») et libère la place.
- **Changement de partie** (menu, autre niveau, autre ferme) : la file est vidée (`clear`), les leçons non vues
  reviendront à leur prochain déclencheur ; un cours en cours retient son étape (§ 5.4, § 6).

### 4.4 Pause pendant une étape

- Une étape `pause: true` (défaut pour lire, viser, choisir) pousse la raison de pause **`coach`** (`app.pushPause`) ; elle
  est retirée à la fin de l'étape. C'est le mécanisme du tutoriel et des conseils d'aujourd'hui, dans les deux modes
  (les actions du joueur marchent pendant la pause : semer, récolter, ramasser…).
- Une étape `pause: false` (« le temps passe », « attendez que ça pousse ») laisse le temps couler.
- Le joueur qui touche le bouton de vitesse lève la pause `coach` (comme `tutorial` aujourd'hui) ; l'étape reste affichée.
- Les **rappels** ne mettent **jamais** en pause.

### 4.5 Les cibles (compatibles zoom et défilement)

Formes (contrat exact : `docs/ARCHITECTURE.md`) :

| Forme | Exemple | Résolution (rectangle de la page, recalculé à chaque image) |
|---|---|---|
| `{ ui: '#tab-buy' }` | onglet, bouton du HUD, ligne « À faire » | `getBoundingClientRect()` si visible |
| `{ ui: '#seed-carrot', sheet: 'seeds' }` | ligne d'une feuille | idem, seulement feuille ouverte |
| `{ plot: 12 }` | une parcelle | `app.plotPageRect(i)` |
| `{ plots: [3, 4, 5, 9] }` | chemin d'un glissé | rectangles des parcelles, dans l'ordre (le doigt passe de l'une à l'autre) |
| `{ scene: { type: 'shelter', buildingId: 'coop' } }` | abri, bâtiment, machine, employé, Joseph, visiteur, tableau, charrette, roulotte, mangeoire, trouvaille, bête, boîte en fer, poteau de la vallée… | `scene.targetRect(hit)` (nouvelle façade : `layout.hitRect` / `actors.rectOf` / `cozyItemRect` / `valleyItemRect` / `placesItemRect` / emplacements du lot 3) → `app.worldPageRect` |
| `{ world: { x, y, w, h } }` | une zone du monde | `app.worldPageRect` |
| `{ view: { type: 'place', id: 'brook' } }` | vue de la vallée | `app.valleyView.targetPageRect(hit)` |
| `{ rect: () => rect }` | calcul libre (pont avec les anciens conseils) | la fonction |

Toute cible porte un **libellé** pour les lecteurs d'écran (« le poulailler », « la carotte mûre en haut à gauche »).

**Montrer une cible hors de l'écran** : avant d'afficher l'étape, la scène défile pour la montrer au-dessus de la bulle
(`scene.focusRect(rect, { bottom: hauteur de la bulle })`, ou `focusPlot`, `focusLot`, `focusBuilding`) ; animé sauf
mouvement réduit. **Zoom** : les rectangles passent par `worldToScreen`, donc suivent le zoom et le défilement à chaque
image ; si la cible fait moins de 48 px CSS au zoom courant, le moteur demande le zoom tactile des modes de visée
(`scene.ensureTouchZoom()`) et rend le zoom du joueur à la fin de la leçon (`scene.restoreZoom()`). Un pincement du
joueur pendant une étape n'est pas gêné : la bulle se replace à l'image suivante.

### 4.6 La bulle, le doigt, la pastille

- **Bulle** (reprise de `tutorial.js`) : pleine largeur en portrait, sous la barre du haut **ou** au-dessus des onglets /
  de la feuille, du côté opposé à la cible ; petite flèche vers la cible ; portrait de Joseph (expression selon l'étape :
  `content`, `happy`, `proud`) ; nom « Joseph » ; texte ; boutons (« Compris », « Suivant », « Plus tard ») ; lien
  « Passer » ; points de progression pour un cours. Grand écran : à côté de la cible (`placeNear`).
- **Doigt** : petite main en pixel art posée sur la cible : `tap` (appuie et relâche, 1,2 s), `press` (appuie, un cercle se
  remplit, 1,6 s), `swipe` (glisse de parcelle en parcelle le long du chemin, 1,6 s, puis reprend), `pinch` (deux doigts qui
  s'écartent au centre de la scène). Anneau doré autour de la cible (repris de `.tuto-ring`) et, sur l'interface, la
  classe `.coach-target` (liseré clair + sombre : visible sur tous les fonds, pas seulement par la couleur).
- **Pastille** (rappel compact) : portrait de Joseph + une ligne, en haut à gauche, touchable (≥ 48 px) : rouvre la
  bulle (leçon réduite) ou fait l'action du rappel (§ 8).
- La couche de l'accompagnement est **au-dessus des feuilles** et **sous les fenêtres** ; les messages s'effacent sous
  la bulle (le bandeau s'efface déjà : `toasts.hideBanner()`) ; les boutons de zoom et la mini-carte se cachent pendant une
  bulle (règle existante de `zoom.js` et `minimap.js`, qui testeront `app.coach.blocking` au lieu de `hints.active`).

### 4.7 Ce que montre chaque réglage

| | **Complet** (défaut d'un nouveau joueur) | **Discret** | **Aucun** |
|---|---|---|---|
| Tutoriel du niveau 1 / de début de carrière | lancé (« Je connais » sur la 1ʳᵉ bulle) | proposé : « Je vous montre les premiers pas ? Oui · Je connais » | non (marqué « à relire » dans le carnet) |
| Leçons **essentielles** (E) | pas à pas, doigt, pause | **1ʳᵉ étape seulement**, en pastille sans pause ; la toucher déroule le pas à pas | non ; ajoutées au carnet (« à lire ») |
| Leçons **utiles** (U) | pas à pas | non ; ajoutées au carnet (« à lire ») | non ; carnet |
| Leçon de passage de rang | après la fenêtre : 3 nouveautés pointées | une pastille « 3 nouveautés : voir » | non |
| Rappels | pastille de Joseph (≤ 1 par jour de jeu, ≤ 4 par saison) + ligne « À faire » + résumé du matin | ligne « À faire » + résumé du matin seulement (aucune pastille) | aucun rappel du moteur (la ligne « À faire » et le résumé du matin restent : ce sont des réglages à part) |
| Sécurité (gel, charges en danger) | leçon + rappel | pastille | message important d'aujourd'hui (comme avant) |
| Pastille « Nouvelle page dans le carnet » | non (déjà vu) | message info dans l'historique | pastille sur le bouton du carnet seulement |
| Fenêtres de jeu (rang, boîte en fer, récits, bilans) | inchangées | inchangées | inchangées (ce n'est pas de l'accompagnement) |

Le réglage se change à tout moment (Options › Accompagnement, et en tête du carnet) ; passer de « Aucun » à « Complet »
ne rejoue rien : les leçons « à lire » restent dans le carnet, les suivantes seront montrées.

### 4.8 Où vivent les données (hors de l'état de partie)

| Donnée | Où | Pourquoi |
|---|---|---|
| Leçons vues | `progression.hintsSeen` (existant, `markHint` / `hintSeen`) | mêmes identifiants que les anciens conseils : rien à migrer ; partagé par les deux modes ; effacé avec la progression |
| Leçons « à lire » (vues sans être montrées, en Discret / Aucun / déjà su) | `une-annee-a-la-ferme.guidance` (préférences du guidage, `guide-prefs.js`) : `unread: [id]` | simple confort d'interface |
| Réglage Complet / Discret / Aucun | `settings.guidance` (`'full' \| 'quiet' \| 'off'`, `DEFAULT_SETTINGS`, vérifié par `loadSettings`) ; `settings.guidanceAsked` | réglage du joueur, comme `messages` |
| Rappels coupés | `guidance.reminders: { [sorte]: { off: true } }` | idem |
| Étape du tutoriel du niveau 1 | `une-annee-a-la-ferme.tutorial` (existant, `{ done, step }`) : `step` devient l'**identifiant** de l'étape (les anciens index sont convertis à la lecture) | reprise d'une partie sauvegardée en plein tutoriel |
| Étape du tutoriel de carrière | `guidance.firstSteps: { key, step }` (`key` = graine de la carrière) | idem ; une nouvelle ferme a une autre clé |
| Compteurs des rappels (dernière fois, ignorés) | **mémoire seulement** (session) | aucun besoin de persister ; jamais dans la partie |

**Classique** : aucune de ces données n'entre dans `game.state` ; la pause passe par `app.pushPause` (raison `coach`),
exactement comme `tutorial` et `hint` aujourd'hui. La parité des niveaux 1 à 8 et `node tools/simulate.js` ne bougent pas.

---

## 5. Le tutoriel de début de carrière (E1, cours `career.firstSteps`)

But : **premier glissé de récolte en 5 secondes**, chaque geste appris en le faisant, ≈ 70 mots en tout, passable.

### 5.1 Avant

- **Nouvelle ferme** (feuille existante : nom, difficulté) : une ligne de plus, « **Premiers pas avec Joseph** » (case
  cochée ; décochée d'office si les rudiments sont déjà sus, § 10.3, avec la mention « Vous connaissez déjà les gestes »).
- La ferme est créée **avec 6 carottes mûres** sur la 1ʳᵉ rangée du champ de départ (option du cœur `starter`, § 15
  point 1) et 2 poules qui n'ont pas encore pondu. Argent : celui de la difficulté (200 / 150). Jour 1 du printemps,
  vitesse ×1 (ou ×½ si l'option « vitesse douce » est cochée).
- La fenêtre « Bienvenue ! » à trois bulles disparaît (son contenu est réparti, § 1).

### 5.2 Geste par geste

| # | Étape (id) | Joseph dit (≤ 2 lignes) | Il montre | Pause | Réussite | Si… |
|---|---|---|---|---|---|---|
| 1 | `harvest` | « Bienvenue ! Vos carottes sont mûres. Glissez le doigt dessus. » | doigt qui glisse sur les 6 carottes (chemin), anneau sur la rangée ; la scène s'est centrée sur le champ | oui | ≥ 1 récolte du joueur | **toucher au lieu de glisser** : récolte quand même ; étape 1 bis |
| 1 bis | `harvestSwipe` | « Sans lever le doigt, tout vient d'un coup ! » | glisse sur les carottes restantes | oui | plus aucune carotte mûre, ou 2 récoltes de plus | sautée si les 6 sont récoltées d'un seul glissé |
| 2 | `paid` | « +45 ! Chaque récolte est payée tout de suite. » | anneau sur l'argent (`#hud-money`), pièces qui volent déjà (juice) | oui | bouton « Super ! » | — |
| 3 | `sowTap` | « Touchez une parcelle vide pour semer. » | doigt qui touche une parcelle vide au centre | oui | feuille `seeds` ouverte | — |
| 4 | `sowPick` | « Prenez la carotte : mûre en 2 jours. » | doigt sur `#seed-carrot` (dans la feuille) | oui | `planted` | feuille fermée sans semer → retour à 3 |
| 5 | `water` | « Glissez sur ce qui est semé pour l'arroser. » | doigt qui glisse sur les parcelles semées non arrosées | oui | ≥ 1 `watered` du joueur | il pleut : sautée, note « Il pleut : la pluie arrose pour vous ! » |
| 6 | `time` | « Le temps avance tout seul. Touchez ici pour aller plus vite. » | doigt sur `#hud-speed` (où qu'il soit : haut, bas, gaucher) | **non** | vitesse ≥ ×2, ou aube suivante | — |
| 7 | `eggs` | « Bonjour ! Les poules ont pondu. Touchez le poulailler. » | doigt sur l'abri (`{ scene: { type: 'shelter', buildingId: 'coop' } }`), la scène défile vers lui | oui | `collected` par le joueur | déclenchée à l'aube du jour 2 (le cours attend, bulle cachée, pastille « Demain : les œufs ») |
| 8 | `buyTab` | « Une poule de plus ? Ouvrez « Acheter ». » | doigt sur `#tab-buy` | oui | feuille `shop` ouverte | bouton « Plus tard » : passe à 10 |
| 9 | `buyHen` | « Touchez « Acheter » sous la poule : 30 pièces. » | doigt sur le bouton de la carte « Poule » (section Animaux dépliée, carte amenée dans la vue) | oui | `purchased` (`investmentId: 'hen'`) | pas assez d'argent (impossible au départ ; garde-fou) : passe à 10 |
| 10 | `end` | « Bravo ! Le reste, je vous le montre en chemin. Tout est dans mon carnet. » | anneau sur l'onglet `#tab-journal` | oui | bouton « Merci, Joseph ! » | — |

Après le cours : `career.start` (objectifs du rang dans le Carnet) attend le jour 3 ; `career.charges` l'aube du jour 4
(ou plus tôt si la prévision n'est pas « couvert ») ; `basics.todo` la première fois que la ligne « À faire » propose
quelque chose ; `basics.longPress`, `basics.sowAll` à leur déclencheur (§ 7.1).

Mots : ≈ 75 en tout (étapes 1 à 10), soit le tiers du tutoriel actuel du niveau 1.

### 5.3 Passer

- 1ʳᵉ bulle : lien « **Je connais** » → fin du cours, ses leçons comptent comme vues (carnet : « passées, à relire »).
- Chaque bulle : « Passer » (cette étape). Deux « Passer » d'affilée → Joseph propose « On arrête là ? Oui · Non ».
- Un geste fait **avant** son étape (le joueur a déjà semé pendant l'étape 1) : l'étape correspondante est sautée
  (`skipIf` sur l'état), jamais rejouée à vide.

### 5.4 Reprise

Partie quittée au milieu du cours : `guidance.firstSteps = { key, step }` ; à la reprise (après « Où en étais-je ? »), le
cours reprend à l'étape retenue, ou à la suivante si son but est déjà atteint (ex. plus de carottes mûres → étape 3).

### 5.5 Joueur qui connaît déjà les rudiments (niveau 1 joué, ou autre carrière)

Le cours est **raccourci** automatiquement : étapes 1 (récolter en glissant, gardée : c'est le plaisir), 7 (œufs), 8-9
(achat dans la boutique de carrière), 10 (carnet) ; « Je connais » toujours offert.

---

## 6. Le tutoriel du niveau 1 (refonte légère, cours `levels.firstYear`)

Mêmes moments qu'aujourd'hui (le joueur s'y retrouve), mais dans le moteur, ≈ 90 mots au lieu de 206, et les gestes qui
manquaient. Le niveau 1 garde **ses parcelles vides** au départ (aucun changement de l'état de partie : parité Classique).

| # | Étape | Joseph dit | Il montre | Pause | Réussite |
|---|---|---|---|---|---|
| 1 | `welcome` | « Un an pour faire vivre la ferme ! Je vous montre ? » | — (Joseph au centre) | oui | « C'est parti ! » · « Je connais » |
| 2 | `sowTap` | « Touchez une parcelle vide. » | doigt sur une parcelle vide (1ʳᵉ rangée, au centre) | oui | feuille `seeds` ouverte |
| 3 | `sowPick` | « Prenez la carotte : pas chère, mûre en 2 jours. » | `#seed-carrot` | oui | `planted` |
| 4 | `water` | « Glissez sur la carotte pour l'arroser. Chaque matin ! » | glissé sur la parcelle semée | oui | `watered` (sautée s'il pleut) |
| 5 | `time` | « Touchez ici pour aller plus vite. Appui long : pause. » | `#hud-speed` | non | vitesse ≥ ×2 ou aube |
| 6 | `wait` | (pastille seule) « Arrosez chaque matin, puis récoltez. » | anneau sur la parcelle | non | carotte mûre |
| 7 | `harvest` | « Elle est mûre ! Glissez dessus pour la récolter. » | glissé sur les parcelles mûres | oui | `harvested` par le joueur |
| 8 | `bill` | « Le dernier soir, on paie le fermage : le loyer de la ferme. » | `#hud-bill` | oui | « Suivant » |
| 9 | `billSign` | « ✓ : c'est payé d'avance. ! : récoltez encore. » (Détente : « Sinon, je vous aide. ») | `#hud-bill` | oui | « Compris » |
| 10 | `coop` | « Un poulailler rapporte chaque matin. Ouvrez « Acheter ». » → dans la feuille : « Touchez « Acheter » ! » | `#tab-shop` puis `#card-chickenCoop` | non | `purchased` · « Plus tard » ; montrée seulement quand l'argent couvre le poulailler **et** le fermage (règle d'aujourd'hui), pastille d'attente sinon |
| 11 | `todo` | « En bas, je note la chose la plus utile. » | `#todo-main` | oui | « Compris » |
| 12 | `end` | « À vous ! Appui long sur une parcelle : sa fiche. Tout est dans mon carnet. » | doigt en appui long sur une parcelle | oui | « Merci ! » |

- L'ancienne attente de l'hiver (étape « dormante ») devient la leçon indépendante `basics.frost` (§ 7.1), qui sert aux
  deux modes ; la fin « Vous savez tout ! » disparaît (l'hiver n'est plus une étape du cours).
- « Semer partout » : leçon `basics.sowAll` à la 1ʳᵉ ouverture des graines avec au moins 4 parcelles vides, après le cours.
- Reprise : `storage.loadTutorial().step` (index d'aujourd'hui converti en identifiant : 0→`welcome`, 1→`sowTap`,
  2→`water`, 3→`time`, 4→`harvest`, 5→`bill`, 6→`coop`, 7→`todo`, 8 et plus → cours terminé, `basics.frost` en attente).
- Calendrier du niveau 1 inchangé (tableau au jour 5, charrette, Basile, défis, fête en été…) : leurs leçons arrivent à
  leur date, après le cours.

---

## 7. Le catalogue complet des leçons

Légende des colonnes : **Niv.** = E (essentielle : montrée en Discret, en pastille) ou U (utile : carnet seulement en
Discret). **Étapes** : « texte de Joseph » → ce qu'il montre (geste). Toutes les étapes visant un geste ont aussi
« Passer » ; celles de lecture ont « Compris » sauf mention. ⟲ = identifiant d'un ancien conseil (déjà vu = vu).
Les textes sont des **premiers jets FALC** (≤ 90 caractères par étape) : le paquet LEÇONS les relit avec la règle du § 3.

### 7.1 Les premiers pas (deux modes, chapitre « Les premiers pas »)

| id | Niv. | Déclencheur | Étapes | Réussite |
|---|---|---|---|---|
| `basics.harvest` | E | cours, ou 1ʳᵉ culture mûre du joueur qui attend depuis 1 jour | ① « Elle est mûre ! Glissez le doigt dessus pour récolter. » → glissé sur les parcelles mûres ② « +12 : c'est payé tout de suite. » → anneau sur l'argent | ① `harvested` (joueur) ② « Super ! » |
| `basics.sow` | E | cours, ou 1ʳᵉ parcelle vide touchée sans semer | ① « Touchez une parcelle vide. » → toucher ② « Choisissez une graine : sa durée et son gain sont écrits. » → `#seed-carrot` (ou 1ʳᵉ ligne abordable) | ① feuille `seeds` ② `planted` |
| `basics.water` | E | cours, ou 1ʳᵉ parcelle semée non arrosée à midi (sans pluie, sans arroseur) | ① « Glissez sur ce qui est semé pour arroser. » → glissé ② « La goutte veut dire : à arroser. Chaque matin ! » → anneau sur une goutte | ① `watered` ② « Compris » |
| `basics.time` | E | cours, ou 2ᵉ jour sans avoir touché la vitesse | ① « Touchez ici pour aller plus vite. Appui long : pause. » → `#hud-speed` | vitesse changée, ou aube (sans pause) |
| `basics.bill` | E | cours (niveau 1), ou 1ʳᵉ partie de niveau sans le cours | ① « Le dernier soir de la saison, on paie le fermage. » → `#hud-bill` ② « ✓ : payé d'avance. ! : récoltez encore. ✗ : attention. » → `#hud-bill` | ② « Compris » |
| `basics.buy` | E | cours, ou 1ʳᵉ fois que l'argent couvre un achat utile **et** le prochain fermage / les charges | ① « Les animaux rapportent chaque matin. Ouvrez « Acheter ». » → `#tab-shop` / `#tab-buy` ② « Touchez « Acheter » sur cette carte. » → bouton de la carte | `purchased` · « Plus tard » |
| `basics.todo` | E | 1ʳᵉ fois que la ligne « À faire » est visible avec une entrée (hors cours) | ① « En bas, je note la chose la plus utile. Touchez-la ! » → `#todo-main` | `todo` touchée, ou « Compris » |
| `basics.longPress` | U | jour 3, ou 1ʳᵉ fiche ouverte par un toucher d'une parcelle déjà arrosée | ① « Appui long sur une parcelle ou un bâtiment : sa fiche. » → appui long sur une parcelle | fiche ouverte par appui long, ou « Compris » |
| `basics.sowAll` | U | feuille des graines ouverte avec ≥ 4 parcelles vides (après `basics.sow`) | ① « « Semer partout » remplit tout le champ d'un coup. » → `#seed-all` | semis groupé, ou « Compris » |
| `basics.zoom` | U | carrière : 1ᵉʳ terrain acheté (la ferme dépasse l'écran) ; niveaux : jamais | ① « Pincez avec deux doigts pour voir toute la ferme. » → geste `pinch` au centre, puis anneau sur les boutons + / − | zoom changé, ou « Compris » |
| `basics.messages` | U | 1ʳᵉ fois avec ≥ 3 messages non lus | ① « Les nouvelles attendent ici, sous la cloche. » → `#todo-bell` | feuille Messages ouverte, ou « Compris » |
| `basics.weather` | U | 1ʳᵉ prévision de pluie pour demain | ① « Demain, il pleut : la pluie arrosera pour vous. » → `#hud-weather` | « Compris » |
| `basics.frost` | E | 1ᵉʳ `seasonWarning` avec `frost` (deux modes) | ① « L'hiver arrive dans 2 jours : le gel tue les cultures fragiles. » → anneau sur le champ ② « Récoltez avant. Navet et chou tiennent le froid. » → `#hud-bill` (niveaux : « le fermage d'hiver est le plus cher ») | ② « Compris » |
| `basics.carnet` | E | fin d'un cours, ou 1ʳᵉ leçon vue hors cours | ① « Tout ce que je vous montre est dans mon carnet. » → onglet Menu (niveaux) / `#tab-journal` (carrière) | « Compris » |
| `basics.collectAll` (= ⟲ `career.collectAll`) | U | ≥ 2 abris à ramasser | ① « Plusieurs abris attendent : « Tout ramasser » les vide d'un coup. » → `#todo-collect` ② « Ou glissez d'un abri à l'autre. » → glissé entre deux abris | `collected` ×2, ou « Compris » |

### 7.2 Mode Niveaux (chapitre « Les niveaux »)

| id | Niv. | Déclencheur | Étapes | Réussite |
|---|---|---|---|---|
| `levels.firstYear` | — | niveau 1, partie neuve, cours non terminé | cours du § 6 | fin du cours |
| `levels.loan` | E | 1ᵉʳ `neighbourLoan` (après la fenêtre « Joseph vous dépanne ») | ① « Une part de vos ventes me rembourse toute seule. » → anneau sur l'argent ② « Vous pouvez aussi me rembourser ici. » → onglet Bilan, puis bouton « Rembourser » | ② « Compris » |
| `levels.drought` | E | début du niveau 2 | ① « Cette année, arroser coûte 1 pièce par parcelle. » → `#hud-money` ② « La pomme de terre pousse sans eau. » → `#seed-potato` (feuille des graines, à sa prochaine ouverture) | ① « Suivant » ② « Compris » |
| `levels.rot` | E | début du niveau 3 | ① « Pluie fréquente : une culture mûre peut pourrir. Récoltez vite ! » → anneau sur le champ | « Compris » |
| `levels.smallPlot` | E | début du niveau 4 | ① « Seulement 6 parcelles : misez aussi sur les animaux. » → `#tab-shop` | « Compris » |
| `levels.longWinter` | E | début du niveau 5 | ① « L'hiver dure 14 jours : gardez des réserves. » → `#hud-bill` | « Compris » |
| `levels.market` | E | début du niveau 6 | ① « Les prix changent chaque jour. Le prix du jour est ici. » → ligne de la feuille des graines (cours) à la 1ʳᵉ ouverture | « Compris » |
| `levels.credit` | E | début du niveau 7 | ① « Le prêt se rembourse les jours 4, 11, 18 et 25 : 150 pièces. » → `#hud-bill` | « Compris » |
| `levels.fatigue` | E | début du niveau 8 | ① « Replanter la même culture donne 30 % de moins. Changez ! » → une parcelle | « Compris » |
| `processing` ⟲ | E | 1ᵉʳ niveau qui propose un atelier | ① « Un atelier change vos récoltes en produits plus chers. » → `#tab-shop` ② (feuille) « Le voici. » → carte de l'atelier | ② « Compris » |
| `processingBought` ⟲ | E | 1ᵉʳ atelier acheté | ① « Interrupteur allumé : les récoltes y vont s'il reste une place. » → `#bld-switch` ② « Le produit se vend tout seul le matin. » | ② « Compris » |
| `tree` ⟲ | U | 1ᵉʳ pommier dans la feuille des graines | ① « Le pommier reste toute l'année : pas d'eau, pas de gel. » → `#seed-apple` | « Compris » |
| `pollination` ⟲ | E | début du niveau 10 | ① « Sans abeilles, les pommiers donnent moitié moins. » → les 4 pommiers ② « Achetez une ruche ! » → `#tab-shop` | ② « Compris » |
| `goat` ⟲ | U | 1ʳᵉ chèvre proposée | ① « La chèvre donne du lait chaque jour. Fromagerie : du fromage ! » → `#tab-shop` | « Compris » |
| `levels.mountain` | E | début du niveau 11 | ① « Été court, hiver long : pommes de terre et chèvres ! » → `#hud-date` | « Compris » |
| `contest` ⟲ | E | début du niveau 12 | ① « Concours le soir du jour 21 : 3 épreuves. » → onglet Bilan ② « Chaque épreuve rapporte 120. » → section Concours | ② « Compris » |
| `levels.sprinkler` | U | 1ᵉʳ arrosage automatique acheté | ① « Il arrose tout seul, chaque matin. » → le bâtiment | « Compris » |
| `levels.sheep` | U | 1ᵉʳ mouton acheté | ① « Le mouton se tond tout seul : 3 fois par an. » → l'enclos | « Compris » |
| `grange` ⟲ | U | menu principal avec ≥ 1 étoile à dépenser | ① « Vos étoiles achètent des bonus, dans la grange. » → `#menu-grange` | « Compris » (`where: 'menu'`) |
| `decor` ⟲ | U | menu principal avec ≥ 10 écus | ① « Vos écus décorent la ferme : Grange → Ma ferme. » → `#menu-grange` | « Compris » (`where: 'menu'`) |
| `menu.career` | U | 1ᵉʳ retour au menu après un niveau gagné, sans carrière | ① « Envie d'une ferme à vous, qui grandit ? C'est ici. » → `#menu-career` | « Compris » (`where: 'menu'`) |

### 7.3 Carrière, rangs 1 → 6 (chapitre « Ma ferme »)

| id | Niv. | Déclencheur | Étapes | Réussite |
|---|---|---|---|---|
| `career.firstSteps` | — | carrière neuve, case « Premiers pas » cochée | cours du § 5 | fin du cours |
| `career.collect` ⟲ | E | 1ᵉʳ abri avec des produits (si pas vu dans le cours) | ① « Les poules ont pondu ! Touchez le poulailler. » → l'abri ② « Un abri garde 3 jours de produits. » | ① `collected` ② « Compris » |
| `career.start` ⟲ | E | jour 3 de la 1ʳᵉ saison | ① « Votre but : le prochain rang. Il est dans le Carnet. » → `#tab-journal` ② (feuille) « Deux objectifs, et le patrimoine à atteindre. » → objectifs | ② « Compris » |
| `career.charges` | E | aube du jour 4, ou prévision ≠ « couvert » | ① « Chaque saison, la ferme a des charges : 20 pièces. » → `#hud-bill` ② « Elles montent quand la ferme grandit. » | ② « Compris » |
| `career.lotForSale` ⟲ | E | 1ʳᵉ aube où un terrain devient abordable (≥ 80 % du prix) | ① « La forêt autour est à vendre. Regardez ! » → panneau « À vendre » de la scène (défile) ② « On l'achète ici, ou dans « Acheter ». » → `#tab-buy` | panneau touché, feuille du terrain, ou « Plus tard » |
| `career.map` | U | 1ᵉʳ terrain acheté | ① « La petite carte : touchez-la pour aller loin. » → mini-carte ② « Re-touchez « Ferme » : la grande carte. » → `#tab-farm` | ② « Compris » |
| `career.develop` | E | 1ᵉʳ terrain acheté resté en friche | ① « Un terrain se transforme : champ, pré… Touchez son panneau. » → panneau du terrain ② (feuille) « Choisissez ici. » → liste des aménagements | `lotDeveloped`, ou « Plus tard » |
| `career.plan` ⟲ | U | 1ᵉʳ champ aménagé | ① « Le plan dit quoi semer, saison par saison, aux machines et à l'équipe. » → `#c-plan-spring` | « Compris » |
| `career.shelter` | U | 1ᵉʳ pré aménagé | ① « Un pré accueille un abri : touchez une place libre. » → emplacement libre ② (feuille) « Bergerie ou chèvrerie, au choix. » | `buildingBuilt`, ou « Plus tard » |
| `career.shelterFull` | U | 1ᵉʳ `shelterFull` | ① « Le poulailler est plein : ramassez, ou agrandissez-le. » → l'abri | « Compris » |
| `career.stand` | U | 1ʳᵉ fois que l'argent couvre l'étal + 2 saisons de charges | ① « L'étal fait payer vos récoltes 20 % de plus. » → carte de l'étal (`#tab-buy`) | « Compris » |
| `career.beehive` | U | 1ʳᵉ ruche achetée | ① « Chaque ruche fait pousser toute la ferme un peu plus vite. » → la ruche | « Compris » |
| `career.offer` | E | 1ʳᵉ offre d'un visiteur | ① « Un visiteur veut des récoltes, payées plus cher. » → le visiteur (scène) ② « Touchez « Voir » pour répondre. Refuser ne coûte rien. » → ligne « À faire » | offre ouverte, ou « Compris » |
| `career.crows` ⟲ | E | 1ᵉʳ `crow` | ① « Un corbeau ! Touchez la parcelle pour le chasser. » → la parcelle marquée | `crowChased` (joueur) |
| `career.finds` | U | 1ʳᵉ fenêtre de trouvailles fermée | ① « Au défrichage, on trouve parfois un trésor. » | « Compris » |
| `career.loan` | E | 1ᵉʳ `neighbourLoan` (carrière) | ① « Une part de vos ventes me rembourse. Ou ici : Carnet, Joseph. » → `#tab-journal` | « Compris » |
| `career.hardship` | E | 1ᵉʳ `hardship` (après sa fenêtre) | ① « L'équipe et les machines se reposent. Tout repart à 50 pièces. » → `#hud-money` | « Compris » |
| `career.yearEnd` ⟲ | U | dernier jour de la 1ʳᵉ année | ① « Ce soir : le bilan de l'année. Puis on continue, même ferme ! » → `#hud-bill` | « Compris » |
| `career.rankUp` (générique) | E | après chaque fenêtre « Nouveau rang » (sauf rang 6 : `career.rank6`) | ① « Nouveau rang ! Trois nouveautés à essayer. » → `#tab-buy` ② (feuille) les 3 cartes nouvelles, l'une après l'autre (anneau, « Suivant ») | ② « Compris » |
| `career.rank2` | E | rang 2 | variante de `career.rankUp` : maison niv. 2 (embauche) · grenier · arroseurs ; « Et Joseph a une surprise demain. » (boîte en fer) | « Compris » |
| `career.hire` ⟲ | E | maison niv. 2 achetée, personne d'embauché | ① « La maison loge des employés. Ouvrez « Équipe ». » → `#tab-staff` ② (feuille) « Choisissez un candidat : son métier est écrit. » → 1ᵉʳ candidat | `staffHired`, ou « Plus tard » |
| `career.assign` | E | 1ᵉʳ employé embauché | ① « Dites-lui où travailler : touchez sa ligne. » → ligne de l'employé ② « Il arrose, sème et ramasse. La récolte, il vous la laisse. » | `staffAssigned`, ou « Compris » |
| `career.leave` ⟲ | E | 1ᵉʳ hiver avec un employé au travail | ① « En hiver, les champs dorment : mettez l'équipe en congé. » → `#tab-staff` ② « Un congé ne coûte rien. » → bouton « Toute l'équipe en congé » | `staffLeave`, ou « Plus tard » |
| `career.storage` ⟲ | E | grenier construit | ① « Le grenier garde vos récoltes quand le prix est bas. » → le grenier ② (fiche) « Choisissez quand il les garde. » → `#c-storage-mode` | ② « Compris » |
| `career.machine` ⟲ | E | 1ʳᵉ machine achetée | ① « Elle travaille seule chaque jour. » → la machine (scène) ② « Son interrupteur est dans la fiche du terrain. » → panneau du terrain | ② « Compris » |
| `career.orchard` | U | 1ᵉʳ verger aménagé | ① « Un verger : plantez des pommiers, ils restent d'une année à l'autre. » → un emplacement d'arbre | « Compris » |
| `career.workshop` | E | 1ʳᵉ cour des ateliers aménagée | ① « Une place d'atelier : touchez-la pour en bâtir un. » → emplacement ② « Il change vos récoltes en produits plus chers. » | `buildingBuilt`, ou « Compris » |
| `career.greenhouse` | U | 1ʳᵉ serre | ① « Dans la serre, tout pousse même en hiver. Arrosez-la ! » → la serre | « Compris » |
| `career.quest` ⟲ | E | 1ʳᵉ quête proposée | ① « J'ai un service à vous demander. Rien ne presse ! » → la ligne « À faire » ② « Je paie bien, et notre amitié grandit. » | « Compris » |
| `career.hearts` | U | 1ᵉʳ `josephHeart` | ① « Un cœur d'amitié ! Voyez ce qu'il vous ouvre : Carnet, Joseph. » → `#tab-journal` | « Compris » |
| `career.contest` | E | 1ᵉʳ `contestAnnounced` | ① « Le comice ! Trois épreuves, jugées le dernier soir d'automne. » → `#tab-journal` ② « La progression est dans l'Agenda. » | ② « Compris » |
| `career.rank3` | E | rang 3 | variante : semoir · moissonneuse · chambre d'hôte (ou mare si la ferme a déjà une chambre) | « Compris » |
| `career.traction` | E | 1ᵉʳ semoir ou moissonneuse sans cheval ni tracteur | ① « Il lui faut un cheval ou un tracteur pour avancer. » → carte de l'écurie | « Compris » |
| `career.animals3` | U | 1ʳᵉ porcherie, clapier ou écurie | ① (cochon) « En automne et en hiver, les cochons trouvent des truffes. » · (lapin) « Chaque saison, les lapins font des petits. » · (cheval) « Le cheval tire les machines, et promène les hôtes. » → l'abri | « Compris » |
| `career.guestHouse` | U | 1ʳᵉ chambre d'hôte | ① « Des hôtes viennent dormir : ça rapporte, surtout l'été. » → la chambre | « Compris » |
| `career.pond` | U | 1ʳᵉ mare | ① « Touchez le ponton : une pêche par jour, même l'hiver. » → le ponton | `fishCaught`, ou « Compris » |
| `career.rank4` | E | rang 4 | variante : tracteur · silo · machines niv. 2 | « Compris » |
| `career.tractor` | U | tracteur acheté | ① « Le tracteur : machines de niveau 2, jardiniers plus rapides. » → le tracteur | « Compris » |
| `career.mood` | U | 1ᵉʳ employé « Las » | ① « Elle est lasse : un congé de 2 jours ou une fête, et ça repart. » → `#tab-staff` | « Compris » |
| `career.rank5` | E | rang 5 | variante : manoir · château d'eau · marché fermier | « Compris » |
| `career.attraction` | U | 1ᵉʳ embellissement acheté | ① « Plus la ferme est belle, plus les touristes viennent. » → l'embellissement | « Compris » |
| `career.rank6` | E | rang 6 | ① « Un Domaine ! 16 terrains, et le comice régional. » ② « Maintenant, tout le temps est à vous. » → panneau du domaine | « Merci, Joseph ! » |

### 7.4 Lot 2 — surprises (chapitre « Les surprises »)

| id | Niv. | Déclencheur | Étapes | Réussite |
|---|---|---|---|---|
| `surprise.quality` | U | 1ʳᵉ récolte « belle » ou « dorée » à la main | ① « Une belle récolte ! Arrosez bien : il y en aura plus. » → la parcelle ② « La fiche montre vos chances. » → appui long | « Compris » |
| `surprise.giant` | E | 1ᵉʳ `giant` | ① « Un légume géant ! Il vaut 6 parcelles. Récoltez-le à la main. » → le géant | `giantHarvested` (joueur), ou « Plus tard » |
| `surprise.dawn` | U | 1ʳᵉ `surprise` (fée, coffre, renard, hérisson, chouette) | ① « Une surprise ce matin ! Elles sont rares, et toujours bonnes. » → l'objet | « Compris » |
| `surprise.forage` | E | 1ᵉʳ `forage` (brouillard, cercle de fées) | ① « Des champignons ! Touchez-les pour les cueillir. » → la parcelle | `foragePicked` |
| `weather.special` | U | 1ʳᵉ `specialWeather` (pluie chaude, heure dorée, arc-en-ciel) | ① « Un temps spécial : son effet est écrit ici. » → `#hud-weather` | « Compris » |
| `weather.golden` | U | 1ʳᵉ heure dorée | ① « Heure dorée : tout se vend 20 % plus cher aujourd'hui. » → `#hud-weather` | « Compris » |
| `weather.wish` | E | 1ᵉʳ `wish` (avant la fenêtre « Faites un vœu ») | ① « Des étoiles filantes cette nuit ! Faites un vœu. » | « Compris » (puis la fenêtre) |

### 7.5 Lot 3 — variété (chapitre « Le village »)

| id | Niv. | Déclencheur | Étapes | Réussite |
|---|---|---|---|---|
| `variety.board` ⟲ | E | 1ʳᵉ commande au tableau (niveau 1 : jour 5) | ① « Le tableau du village : des voisins demandent des récoltes. » → le tableau (scène) ② (feuille) « Gardez une commande avec la punaise. Refuser ne coûte rien. » → `#v-reroll` / punaise | ① tableau touché ② « Compris » |
| `variety.cards` ⟲ | E | 1ʳᵉ page « Un cadeau pour la saison » | ① « Deux cadeaux : gardez celui qui vous plaît. » → les cartes (`where: 'dialog:season-end'`) | carte choisie, ou « Plus tard » |
| `variety.challenges` ⟲ | U | 1ʳᵉ proposition de défis | ① « Gardez un ou deux défis : chaque palier donne une médaille. » → les défis | défi choisi, ou « Compris » |
| `variety.cart` ⟲ | E | 1ʳᵉ charrette | ① « La charrette veut des caisses de récoltes, d'ici la fin de saison. » → la charrette ② « Même à moitié pleine, elle paie. » | ① charrette touchée ② « Compris » |
| `variety.merchant` ⟲ | U | 1ʳᵉ arrivée de Basile | ① « Basile passe 2 jours : graines rares et petits trésors. » → la roulotte | roulotte touchée, ou « Compris » |
| `variety.rare` ⟲ | U | 1ᵉʳ sachet rare acheté | ① « Un sachet rare : chaque semis prend une graine, gratuitement. » → feuille des graines | « Compris » |
| `career.theme` ⟲ | U | 1ᵉʳ `themeStarted` | ① « Cette année a son thème : une vedette mieux payée, une fête. » → bandeau / Carnet | « Compris » |
| `career.themeVisitor` | U | 1ʳᵉ offre `themeVisitor` | ① « Un visiteur unique ! Il apporte un cadeau. » → le visiteur | « Compris » |

### 7.6 Lot 4 — collection et enjeux doux (chapitre « Fêtes, hiver et album »)

| id | Niv. | Déclencheur | Étapes | Réussite |
|---|---|---|---|---|
| `cozy.album` ⟲ | U | 1ʳᵉ case d'album | ① « Une case de l'album ! Chaque chose vécue y a sa page. » → Menu › L'album | « Compris » |
| `cozy.albumReward` | U | 1ʳᵉ page complète non reçue | ① « Une page complète : touchez « Recevoir » ! » → bouton de la page | reçue, ou « Compris » |
| `cozy.helpers` ⟲ | E | 1ʳᵉ récolte mûre qui « vous attend » (équipe ou machine présente) | ① « L'équipe vous laisse les récoltes 3 jours. À la main : +25 % ! » → le badge « vous attend » | `harvested` (joueur), ou « Compris » |
| `cozy.fete` ⟲ | E | 1ʳᵉ `feteSoon` | ① « Demain, c'est jour de fête : un petit jeu, sans chrono. » → bandeau / ligne « À faire » | « Compris » |
| `fete.chasse` | E | 1ʳᵉ chasse aux œufs ouverte | ① « Trouvez 8 œufs cachés : touchez-les. » → un œuf (`where: 'fete'`) ② « Bloqué ? L'indice est ici. » → bouton « Indice » | 1 œuf trouvé |
| `fete.marmite` | E | 1ʳᵉ soupe partagée ouverte | ① « Mettez 1 à 3 légumes de l'année dans la marmite. » → les légumes (`where: 'fete'`) | `feteDone`, ou « Compris » |
| `fete.etal` | E | 1ᵉʳ stand de la ferme ouvert | ① « Remplissez 5 cagettes : la variété et la qualité comptent. » → une cagette | `feteDone`, ou « Compris » |
| `fete.paniers` | E | 1ᵉʳˢ paniers de Noël ouverts | ① « Garnissez un panier pour chaque voisin. » → un panier | `feteDone`, ou « Compris » |
| `fete.theme` | U | 1ʳᵉ fête d'une année à thème | ① « Une fête de l'année : même jeu, nouveau décor ! » | « Compris » |
| `cozy.seedFair` ⟲ | E | 1ʳᵉ foire aux graines | ① « Des sachets à −25 % : vos semis du printemps les prendront. » → un étal | `seedPackBought`, ou « Compris » |
| `cozy.winter` ⟲ | E | 1ᵉʳ hiver (1ʳᵉ `winterFind`) | ① « En lisière, des trouvailles d'hiver : touchez-les. » → une trouvaille | `winterPicked` |
| `winter.feeder` | U | 1ʳᵉ mangeoire | ① « Remplissez la mangeoire : demain, un oiseau viendra. » → la mangeoire | `feederFilled` |
| `winter.veillee` | U | 1ᵉʳ `storyReady` | ① « Ce soir, veillée chez moi : touchez ma fenêtre. » → fenêtre de la veillée | `storyHeard`, ou « Plus tard » |
| `cozy.lanterns` ⟲ | U | 1ʳᵉ page des lanternes | ① « Une lanterne par critère, toujours. L'an prochain, on fait mieux ! » (`where: 'dialog'`) | « Compris » |

### 7.7 La Vallée V1 → V3 (chapitre « La Vallée »)

| id | Niv. | Déclencheur | Étapes | Réussite |
|---|---|---|---|---|
| `valley.box` ⟲ | E | `valleyStarted` (après la fenêtre « La boîte en fer ») | ① « Ma boîte est sur votre perron. Touchez-la. » → la boîte (scène) | fiche « La Vallée » ouverte |
| `valley.sheet` | E | 1ʳᵉ ouverture de la fiche « La Vallée » | ① « En haut : le prochain but. Je le mets à jour. » → l'indice ② « Graines, habitants, aménager : tout est ici. » → les segments | ② « Compris » |
| `valley.jar` ⟲ | E | 1ᵉʳ bocal à ouvrir | ① « Un bocal : ouvrez-le pour voir la graine. » → bouton du bocal | `jarOpened` |
| `valley.trial` ⟲ | E | 1ʳᵉ graine ancienne semée | ① « Récoltez-la à la main : elle vous rend 2 graines. » → la planche d'essai ② « 7 récoltes à la main : la variété est sauvée. » → la barre | ① `heirloomHarvest` (joueur) ② « Compris » |
| `valley.fixed` ⟲ | U | 1ʳᵉ variété fixée | ① « Sauvée ! Ses graines sont sans fin, l'équipe peut la semer. » → feuille des graines | « Compris » |
| `valley.traits` | U | 2ᵉ variété obtenue | ① « Chaque variété a un don : son dessin et son nom le disent. » → le trait d'une variété | « Compris » |
| `valley.nature` ⟲ | E | 1ᵉʳ aménagement payable (haie, nichoir…) | ① « Une haie, un nichoir : les bêtes viendront. Touchez « Aménager ». » → bouton ② « Touchez une place qui brille. » → un emplacement (`where: 'placing'`) | `naturePlaced`, ou « Plus tard » |
| `valley.recipe` | U | 1ʳᵉ recette à une chose près | ① « Il manque une haie pour le hérisson. » → la recette dans la fiche | « Compris » |
| `valley.speciesHint` | U | 1ᵉʳ `speciesHint` | ① « Une trace ce matin… Une bête va venir. » → l'indice (scène) | « Compris » |
| `valley.species` ⟲ | E | 1ᵉʳ `speciesVisible` | ① « Elle est là ! Touchez-la pour qu'elle s'installe. » → la bête | `speciesInstalled` |
| `valley.fallow` ⟲ | U | 1ʳᵉ feuille des graines sur une parcelle vide d'un champ, Vallée commencée | ① « Jachère fleurie : gratuite. La culture suivante poussera mieux. » → `#seed-fallow` | `fallowSown`, ou « Compris » |
| `valley.hedge` | U | 1ʳᵉ `hedgeFinds` | ① « Des mûres sur la haie ! Touchez pour cueillir. » → la trouvaille | `hedgePicked` |
| `valley.stage` ⟲ | E | 1ᵉʳ `valleyStage` (étapes 1 → 7 : la même leçon) | ① « La vallée revit ! J'ai quelque chose à vous dire. » → ligne « À faire » (chapitre) | chapitre lu, ou « Plus tard » |
| `valley.reserve` | U | 1ᵉʳ `natureReserved` | ① « Vos aménagements attendent : replacez-les, c'est gratuit. » → segment « Aménager » | « Compris » |
| `valley.fair` | U | 1ʳᵉ foire avec l'étal « La grainothèque du pays » | ① « Un sachet ancien, une fois par an. » → l'étal | « Compris » |
| `valley.librarySign` | E | panneau « Ici, une grainothèque ? » posé | ① « Une idée : une grainothèque ici. Touchez le panneau. » → le panneau | fiche ouverte, ou « Plus tard » |
| `valley.library` ⟲ | E | `seedLibraryBuilt` niveau 1 | ① « Vos graines ont une maison. Touchez-la pour la collection. » → le bâtiment | « Compris » |
| `valley.troc` ⟲ | E | 1ᵉʳ `trocOffered` | ① « Un voisin propose un troc : touchez le sachet. » → la punaise au tableau ② (feuille) « Donnez une graine sauvée. Ça ne coûte rien. » → une variété | `seedSwapped`, ou « Plus tard » |
| `valley.pair` ⟲ | E | 1ʳᵉ paire possible (2 variétés d'une même culture) | ① « Semez ces deux-là côte à côte. » → bouton « Semer la paire » ② « Récoltez l'une à la main, l'autre à côté : une rencontre. » | `pairSown`, ou « Compris » |
| `valley.cross` ⟲ | E | 1ᵉʳ `crossFound` | ① « Une graine née chez vous, à votre nom ! Sauvez-la. » | « Compris » |
| `valley.scented` ⟲ | U | 1ʳᵉ variété parfumée | ① « Parfumée : à l'atelier, elle vaut 15 % de plus. » | « Compris » |
| `valley.revisitBox` | U | 1ʳᵉ ouverture de l'onglet Graines après le V2 | ① « Ma boîte se relit ici, quand vous voulez. » → « Revoir la boîte » | « Compris » |
| `valley.viewOpen` | E | `valleyViewOpened` | ① « Venez sur la colline : touchez le poteau. » → le poteau « Vers la vallée » | vue ouverte |
| `valley.view` ⟲ | E | 1ʳᵉ vue de la vallée | ① « Touchez un lieu pour voir ce qui lui manque. » → le ruisseau (`where: 'view'`) | fiche d'un lieu ouverte |
| `valley.place` | E | 1ʳᵉ fiche d'un lieu | ① « ✓ : c'est prêt. ✗ : il manque encore ça. » → la liste ② « Tout est ✓ ? Lancez le chantier. » → le bouton | ② « Compris » |
| `valley.works` ⟲ | U | 1ᵉʳ `worksStarted` | ① « Le lieu reprend tout seul, saison après saison. » → la barre | « Compris » |
| `valley.valleyAnimal` ⟲ | E | 1ʳᵉ bête de la vallée qui attend | ① « Une bête de la vallée ! Touchez-la. » → la bête (`where: 'view'`) | `speciesInstalled` |
| `valley.river` ⟲ | U | ruisseau à l'étape de pêche | ① « Une pêche par jour au ruisseau, en plus de la mare. » → le ruisseau | `riverFished`, ou « Compris » |
| `valley.mushrooms` | U | 1ᵉʳ `mushroomsGrew` | ① « Des champignons dans le bois : touchez-les. » → la trouvaille | `mushroomPicked` |
| `valley.grafts` | U | 1ᵉʳ greffon du verger conservatoire | ① « Un greffon : plantez-le au verger. » → un emplacement d'arbre | « Compris » |
| `valley.wild` ⟲ | E | 16 terrains et vue ouverte | ① « Les forêts autour peuvent revenir à la nature. » → une forêt à confier ② « Choisissez : bois, marais ou prairie. » | `wildLandGiven`, ou « Plus tard » |

### 7.8 Vallée V4 et lots futurs (modèle)

Le V4 « Les cigognes » est en conception (`docs/VALLEE.md` § 11.4 et suivants, autre agent). Son contrat prévoit quatre
conseils « première fois » (`STORKS_HINTS` : `valley.legend`, `valley.visitor`, `valley.book`, `valley.sounds`) : ils
deviennent **quatre leçons du même identifiant** (s'ils sont livrés avant le moteur, le pont `app.hints.maybe` les
absorbe sans rien perdre). Leçons à prévoir en plus, selon le V4 livré : semer et récolter une légende sous sa cloche,
toucher un visiteur rare dans la vue, le nid des cigognes. **Chaque mécanique nouvelle du V4 reçoit une leçon** de ce
modèle, ajoutée au fichier `src/ui/coach/lessons/valley.js` par le paquet UI du V4 :

```
id: 'valley.<mécanique>'   déclencheur : l'événement du cœur qui l'annonce (ou son premier état visible)
étapes : 1 ou 2, ≤ 90 caractères, cible = l'objet de la scène ou de la vue    réussite : le geste du joueur, sinon « Compris »
rappel : seulement si quelque chose attend un geste du joueur (règles du § 8)
```

---

## 8. Les rappels (« ne pas oublier »)

### 8.1 Principe

Un **rappel** dit qu'une chose utile **attend** depuis un moment. Ce n'est pas une leçon (pas de pas à pas) : c'est une
pastille de Joseph (Complet) qui pointe la ligne « À faire », ou une ligne dans le résumé du matin (Discret). **Aucun
rappel n'est une alerte** : ce qui presse vraiment (corbeaux, gel, charges en danger) a déjà sa place (messages
importants, priorité de la ligne « À faire »).

### 8.2 Rythme

- **Seuil d'attente** propre à chaque rappel (tableau), compté en jours de jeu.
- **Au plus 1 pastille par jour de jeu** et **4 par saison** (toutes sortes confondues) ; **jamais la même sorte deux
  jours de suite** ; jamais pendant une leçon, une feuille, une fenêtre, une fête, la vue de la vallée.
- **Discrétion** : la pastille reste 6 s (12 s en texte 150 %), sans son (petit « pop » doux si les effets sont activés),
  sans vibration, sans pause ; la toucher fait l'action (même chose que la ligne « À faire »).
- **Ignoré trois fois** (pastille non touchée) → la sorte se tait **jusqu'à la saison suivante** (« Joseph ne répète pas »).
- **« Ne plus me le rappeler »** : appui long sur la pastille, ou carnet › Rappels (interrupteur par sorte).
- **Au retour** (« Où en étais-je ? ») : aucun rappel pendant 1 jour de jeu (la fenêtre de reprise dit déjà tout).

### 8.3 Ton

Toujours au présent, positif, sans reproche ni chiffre perdu : « Vos carottes sont mûres, quand vous voulez. »,
« Mme Rose attend votre troc, rien ne presse. » Jamais « vous avez oublié », « dépêchez-vous », « dernière chance »,
« vous perdez… ». Couleur neutre (bois), jamais rouge. Une chose qui a une date (charrette, Basile) dit qu'elle
**reviendra** (« La charrette part ce soir. Elle revient la saison prochaine. »).

### 8.4 La liste

| Sorte (`id`) | Mode | Condition | Seuil | Pastille / ligne du matin | Action au toucher |
|---|---|---|---|---|---|
| `harvest` | deux | ≥ 3 parcelles mûres du joueur (hors équipe à son tour) | mûres depuis 1 jour | « Vos récoltes sont mûres, quand vous voulez. » | ligne « À faire » (vue sur les parcelles) |
| `water` | deux | ≥ 3 parcelles semées non arrosées, plus de 50 % du jour, pas de pluie ni d'arroseur | même jour | « Un peu d'eau ? Elles pousseront plus vite. » | idem |
| `sow` | deux | ≥ 4 parcelles vides depuis 2 jours, une graine abordable, pas en hiver sans culture d'hiver | 2 jours | « Des parcelles se reposent. On sème ? » | feuille des graines |
| `money.low` (ex-`maybeLowMoneyHint`) | deux | prévision du fermage / des charges « juste » ou « danger », ≤ 3 jours | 1 fois par saison | texte d'aujourd'hui (récolter / semer vite / arroser ; Détente : « Et je peux vous avancer le reste. ») | fiche du fermage |
| `shelter` | C | abri plein (produits perdus demain) | plein depuis 1 jour | « Le poulailler est plein : un toucher et c'est ramassé. » | ramasser (vue sur l'abri) |
| `waiting` (F1) | C | récoltes « vous attendent » à leur 2ᵉ aube | 2ᵉ aube | « Vos récoltes vous attendent encore un jour : +25 % à la main. » | vue sur les parcelles |
| `leave` | C | hiver, ≥ 1 employé au travail et aucun champ semé (hors serre) | jour 2 de l'hiver | « Les champs dorment : un congé pour l'équipe ? » | feuille Équipe |
| `stock` | C | grenier ≥ 10 unités, cours ≥ 1,15 pour une culture stockée, pas de vendeur | même jour | « Le cours du blé est haut : c'est le moment de vendre. » | fiche du grenier |
| `quest` | C | quête de Joseph livrable (depuis le grenier ou les récoltes) | 1 jour | « J'ai vu que vous aviez mes pommes de terre ! » | feuille de la quête |
| `offer` | C | offre d'un visiteur ouverte non répondue | 2 jours | « Mme Leblanc attend votre réponse. Refuser ne coûte rien. » | feuille de l'offre |
| `order` | deux | commande gardée complète-able (grenier ou récoltes possédées) | 1 jour | « La commande de Lili est prête à livrer. » | feuille du tableau |
| `cart` | deux | charrette, dernier jour, une caisse remplissable avec ce qu'on a | dernier jour, après 30 % du jour | « La charrette part ce soir. Elle revient la saison prochaine. » | feuille de la charrette |
| `cards` | deux | cadeau de saison pas choisi | 2 jours | « Votre cadeau de saison vous attend. » | page du cadeau |
| `challenges` | deux | défis proposés, aucun gardé | jour 2 | « Un défi pour la saison ? » | page des défis |
| `merchant` | deux | Basile présent, rien acheté, son 2ᵉ jour | 2ᵉ jour | « Basile repart ce soir. Il revient la saison prochaine. » | roulotte |
| `fete` | deux | jour de fête, mini-jeu pas commencé, après 40 % du jour | même jour | « C'est la fête au village ! Un petit jeu ? » | feuille de la fête |
| `winter` | deux | ≥ 3 trouvailles d'hiver en lisière, ou mangeoire vide depuis 2 jours | 1 jour | « Des trouvailles vous attendent en lisière. » / « La mangeoire est vide. » | vue sur l'objet |
| `veillee` | deux | veillée prête, pas écoutée | 2 jours | « Je vous attends ce soir, au coin du feu. » | fenêtre de la veillée |
| `album` | deux | page d'album complète non reçue | 1 jour | « Une page de l'album est complète ! » | l'album |
| `jar` | C | bocal à ouvrir | 2 jours | « Un bocal attend d'être ouvert. » | fiche La Vallée |
| `species` | C | bête venue (ferme ou vallée) pas encore vue | 2 jours | « Le hérisson vous attend près de la haie. » | vue sur la bête |
| `troc` | C | troc proposé, pas fait | 3 jours | « Mme Rose attend votre troc, rien ne presse. » | sachet du tableau |
| `chapter` | C | chapitre / récit de Joseph à lire | 2 jours | « J'ai quelque chose à vous raconter. » | le récit |
| `trial` | C | planche d'essai mûre qui « vous attend » | 1 jour | « Votre planche d'essai est mûre : 2 graines à la main ! » | vue sur la planche |

Les entrées de la ligne « À faire » qui existent déjà (récolter, arroser, semer, abri plein, offre, quête, commande…)
**ne sont pas recopiées** : le rappel ne fait que pointer l'entrée existante (`todo.pointAt(id)`) et la mettre en tête
le temps de la pastille. Les rappels sans entrée « À faire » aujourd'hui (`stock`, `leave`, `cards`, `challenges`,
`merchant`, `album`, `trial`) en fournissent une (`todo.addProvider`), avec les priorités de `todo.js` (60 à 80 : jamais
devant les corbeaux ni les charges).

### 8.5 Résumé du matin

À l'aube, **un** rappel dû (le plus prioritaire, s'il n'a pas eu de pastille la veille) devient la dernière ligne du
résumé : « Joseph : le hérisson vous attend près de la haie. » Les autres attendent. Avec « Messages à l'écran :
Importants » (défaut), le résumé est derrière la cloche : la ligne y est aussi.

---

## 9. Le carnet de Joseph

### 9.1 Où

- **Niveaux** : menu Pause › « Le carnet de Joseph » (remplace « Guide de la ferme ») ; options › Accompagnement ›
  « Ouvrir le carnet ».
- **Carrière** : onglet **Carnet** › segment **Joseph** › « Ses leçons » ; menu Pause › « Le carnet de Joseph ».
- Partout : toucher le portrait d'une bulle ou d'une pastille → le carnet, à la page de la leçon.
- Au menu principal : depuis les options (Accompagnement › « Ouvrir le carnet ») pour relire sans jouer ; « Me montrer »
  y est grisé (« En partie seulement »).

### 9.2 Ce qu'il montre (feuille haute, pause pendant la lecture)

```
┌──────────────────────────────────────────┐
│ ▬                Le carnet de Joseph   ✕ │
│ [portrait] « Tout ce que je vous ai      │
│            montré est noté ici. »        │
│ Accompagnement : [Complet][Discret][Aucun]│
│ ┌ Leçons ┬ Mots de la ferme ┬ Rappels ┐  │
│ ▼ Les premiers pas            12 / 14   │
│   ✓ Récolter en glissant           ›    │
│   ✓ Semer                          ›    │
│   ● Appui long : la fiche  (à lire) ›   │
│ ▶ Ma ferme                      9 / 9   │
│ ▶ Le village                    3 / 3   │
│ ▶ La Vallée                     4 / 4   │
│   … et 6 leçons à venir                  │
└──────────────────────────────────────────┘
```

- **Leçons** : chapitres repliables (Les premiers pas · Le temps et l'argent · Les niveaux · Ma ferme · Les surprises ·
  Le village · Fêtes, hiver et album · La Vallée), dans l'ordre du jeu. Seules les leçons **vues** ou **à lire** sont
  listées (rien n'est gâché à l'avance : « … et 6 leçons à venir »). Lignes ≥ 56 px : icône, titre, état (✓ vue, ● à lire,
  ↷ passée).
- **Page d'une leçon** : le titre, ses étapes en texte (la même phrase que la bulle, avec une petite icône de la cible),
  et deux boutons : « **Me montrer** » (rejouer, § 9.3) · « Retour ».
- **Mots de la ferme** : le glossaire de `guide.js` (fermage = loyer de la ferme…), filtré par mode.
- **Rappels** : un interrupteur par sorte de rappel (§ 8.4), avec sa phrase d'exemple.
- **Règles** (le reste du guide de la ferme : le temps, l'argent, les animaux…) : un 4ᵉ segment, ou dans « Mots » selon
  le point 2 du § 15.

### 9.3 Rejouer (« Me montrer »)

- Le carnet se ferme, la leçon démarre **tout de suite** si son contexte est possible (ex. « Ramasser les œufs » : il faut
  un abri) ; sinon la page le dit (« Possible quand vous aurez un grenier », « En partie seulement »).
- En rejeu, **chaque étape a « Suivant »** : on peut regarder sans faire. Les étapes à geste restent faisables pour de vrai
  (le moteur n'appelle jamais une action de jeu à la place du joueur).
- Une étape dont la cible n'existe pas aujourd'hui (pas de parcelle mûre) montre la zone (« Quand une culture est mûre,
  glissez dessus. », anneau sur le champ).
- Un cours (premiers pas) se rejoue en entier, sans le premier achat si la ferme n'a pas l'argent.
- Rejouer ne change rien à la progression (la leçon est déjà vue) ni à la partie.

---

## 10. Réglage, premier lancement, anciennes parties

### 10.1 Au premier lancement

La fenêtre « Bienvenue ! » (`a11yWelcome`, une seule fois) gagne une section, après la taille du texte :

```
  Joseph vous accompagne
  ( ● Complet )   Je vous montre tout, pas à pas.
  (   Discret )   Juste un mot quand c'est nouveau.
  (   Aucun   )   Je vous laisse découvrir.
```

Défaut : **Complet**. Le choix est enregistré (`settings.guidance`, `settings.guidanceAsked = true`).

### 10.2 Joueur qui a déjà joué (mise à jour du jeu)

Si `guidanceAsked` est faux et que la progression montre un joueur expérimenté (§ 10.3), la question est posée **une
fois**, par Joseph, au premier lancement d'une partie après la mise à jour (bulle sans pause, `where: 'game'`) :
« Je peux vous montrer les nouveautés en chemin. » → [Complet] [Discret ●] [Aucun] — **Discret présélectionné** pour un
joueur expérimenté (point 3 du § 15).

### 10.3 Déduire ce qui est déjà su (ne pas rejouer les rudiments à un joueur expérimenté)

Au chargement, le moteur passe une fois sur le catalogue : chaque leçon non vue dont `acquired(ctx)` est vrai est
**marquée vue** sans être montrée, et ajoutée « à relire » au carnet (sans pastille). Règles :

| Leçons | Déjà sues si… |
|---|---|
| tous les `basics.*` du geste (récolter, semer, arroser, temps, argent, acheter) | un niveau gagné, **ou** le tutoriel du niveau 1 terminé (`tutorial.done`), **ou** une carrière commencée qui a dépassé le jour 3, **ou** ≥ 20 récoltes au cumul (`progress.lifetime`) |
| `basics.todo`, `basics.longPress`, `basics.sowAll`, `basics.messages` | ≥ 2 niveaux gagnés, ou une carrière en an 2 ou plus |
| `levels.firstYear` | `tutorial.done` |
| `career.firstSteps` | une carrière existante au chargement (sauvegarde déjà là), ou une archive de carrière |
| `levels.<niveau>` | ce niveau déjà gagné ou commencé (`progress.levels[id]`) |
| leçons de mécanique de carrière | l'état montre la mécanique utilisée : `career.hire` ← un employé ; `career.machine` ← une machine ; `career.storage` ← stock > 0 ou grenier niv. ≥ 2 ; `career.develop` ← un terrain aménagé ; `career.lotForSale` ← un terrain acheté ; `career.leave` ← un congé déjà pris ; `career.quest` ← une quête faite ; `career.rankN` ← rang actuel > N ; etc. (prédicat dans chaque leçon) |
| leçons des lots 2–4 | l'album ou les compteurs le montrent (case « dorée », géant, fête jouée, mangeoire remplie…) |
| leçons de la Vallée | l'état de la Vallée le montre (`jarOpened` déjà fait ← un bocal ouvert ; `valley.troc` ← un troc fait ; `valley.view` ← vue déjà ouverte…) |
| anciens conseils | identifiant déjà dans `hintsSeen` (rien à faire : mêmes identifiants) |

Une carrière **reprise en plein milieu** d'une mécanique (bête qui attend, troc en attente) ne reçoit pas la leçon si la
mécanique a déjà été faite **une fois** ; sinon elle la reçoit normalement (c'est le bon moment).

---

## 11. Accessibilité

- **Lecteurs d'écran** (TalkBack) : la bulle est une région `role="dialog"` nommée « Joseph » (`aria-labelledby` sur le
  titre), son texte est annoncé (`aria-live="polite"`) avec la cible : « Joseph : Glissez le doigt sur les carottes. Cible :
  la rangée de carottes mûres. » ; la pastille d'un rappel est un vrai bouton (« Joseph : vos récoltes sont mûres.
  Toucher pour y aller. ») ; le doigt et l'anneau sont `aria-hidden`. La scène n'étant pas accessible au lecteur, **toute
  étape à geste dans la scène a « Passer »**, et le carnet garde le texte de chaque étape.
- **Mouvement réduit** : pas d'animation du doigt (il est posé, avec une flèche en pointillés pour un glissé), pas de rebond
  de bulle, défilement de la scène sans animation, anneau fixe (pas de pulsation).
- **Texte 130–150 %** : la bulle peut prendre 3 à 4 lignes ; si elle ne tient ni au-dessus ni au-dessous de la cible, la
  scène défile, puis la bulle se réduit en pastille (règle d'aujourd'hui, `positionPortrait`) ; la pastille d'un rappel
  reste 12 s ; aucun texte coupé (défilement interne de la bulle au-delà de 40 % de la hauteur).
- **Contraste** : texte de la bulle ≥ 4,5:1 ; cible marquée par un liseré clair **et** sombre et par le doigt (jamais la
  couleur seule) ; mode contrastes renforcés : bulle opaque, liseré épais.
- **Une main / pouce** : bulle en bas = boutons dans le tiers bas ; gaucher : doigt et pastille en miroir.
- **Temps** : aucune étape de lecture n'a de minuteur ; le temps du jeu est arrêté pendant les étapes de lecture.
- **FALC** : règles du § 3 point 4, vérifiées par un test (longueur, nombre de mots par phrase).
- **Lecture à voix haute** (recommandation 21 de l'audit, plus tard) : point d'accroche `coach.onSay(text)` pour
  `speechSynthesis` (option à venir).

---

## 12. Maquettes texte (Pixel 7, 412 × 915, portrait)

**Étape 1 du tutoriel de carrière** (bulle en haut, cible en bas) :

```
┌───────────────────────────────────┐
│ 200 ¤        An 1 · Printemps 1/7 │  HUD
├───────────────────────────────────┤
│ ┌──[J]─ Joseph ────────────────┐  │  bulle (≤ 2 lignes)
│ │ Bienvenue ! Vos carottes sont │  │
│ │ mûres. Glissez le doigt dessus│  │
│ │            Je connais · ●○○○○ │  │
│ └──────────────┬────────────────┘  │  flèche vers la cible
│   maison · poulailler    ▼         │
│  ┌──┬──┬──┬──┐                     │
│  │🥕│🥕│🥕│🥕│ ← anneau doré         │
│  │🥕│🥕│  │  │   ☝ → → →  (doigt)  │
│  ├──┼──┼──┼──┤                     │
│  │  │  │  │  │                     │
├───────────────────────────────────┤
│ Ferme  Acheter  Équipe Carnet Menu │
└───────────────────────────────────┘
```

**Étape dans une feuille** (graines) : la bulle se pose au-dessus de la feuille, la flèche vers la ligne « Carotte » ;
la feuille n'est pas couverte.

**Pastille de rappel** (Complet) :

```
┌───────────────────────────────────┐
│ [J] Vos récoltes sont mûres,      │  ≥ 48 px, en haut à gauche, 6 s
│     quand vous voulez.        ›   │  (toucher = y aller ; appui long = ne plus rappeler)
└───────────────────────────────────┘
```

**Leçon du passage de rang** (après la fenêtre « Nouveau rang ! ») : étape 1 bulle « Nouveau rang ! Trois nouveautés à
essayer. » → doigt sur « Acheter » ; étape 2 dans la feuille : la 1ʳᵉ carte nouvelle entourée, « La maison loge des
employés. » → « Suivant » → 2ᵉ carte → 3ᵉ carte → « Compris ».

**Question au joueur expérimenté** (bulle, sans pause) :

```
│ [J] Je peux vous montrer les nouveautés en chemin. │
│   [ Complet ]  [ ● Discret ]  [ Aucun ]            │
```

---

## 13. Cas limites

| Cas | Comportement |
|---|---|
| Fenêtre de fin de saison / bilan annuel / rang qui s'ouvre pendant une étape | étape suspendue, bulle cachée ; reprise à la fermeture (sauf si son but a été atteint entre-temps : étape suivante) |
| Le joueur fait autre chose que demandé (achète au lieu de semer) | rien n'est refusé ; l'étape attend, le doigt rejoue à 15 s ; si le geste demandé devient impossible (plus de parcelle vide), l'étape est sautée |
| Le joueur fait le geste avant l'étape | `skipIf` : étape sautée |
| Cible disparue (feuille fermée, parcelle récoltée par l'équipe, bête déjà vue) | retour à l'étape d'ancrage, ou étape sautée si son but est atteint ; la leçon n'est jamais coincée |
| Cible hors écran (autre terrain, carte 2D) | défilement (`focusRect`, `focusLot`) avant l'étape ; si la feuille couvre, la bulle attend |
| Cible trop petite au zoom courant | zoom tactile demandé, rendu à la fin |
| Le joueur pince ou fait défiler pendant l'étape | la bulle et l'anneau suivent à l'image suivante |
| Plusieurs déclencheurs le même jour (rang 2 : maison, grenier, boîte en fer) | file par priorité ; respiration 20 s ; ≤ 3 par jour ; la leçon du rang en premier, la boîte en fer (fenêtre de jeu) n'est pas retardée |
| Fête ou vue de la vallée en cours | seules les leçons `where: 'fete'` / `'view'` s'affichent ; les autres attendent |
| Mode décoration, modes de visée | idem (`where: 'placing'` seulement pour `valley.nature`, `valley.wild`) |
| Téléphone tourné, appli en arrière-plan | bulle cachée, pause existante ; reprise au retour |
| Partie quittée en plein cours | étape retenue (§ 5.4, § 6) ; une leçon simple non finie redevient « en attente » |
| Deux onglets / deux appareils | progression partagée par le stockage local (même règle que les conseils aujourd'hui) |
| Stockage indisponible (navigation privée) | tout marche en mémoire pour la session ; « vue » ne survit pas au rechargement (comme aujourd'hui) |
| Classique | leçons montrées de la même façon (le tutoriel et les conseils y existent déjà) ; leçons des lots 2–4 jamais déclenchées (clés d'état absentes) ; aucun rappel des lots 2–4 |
| Niveau 1 rejoué après l'avoir gagné | pas de cours (déjà vu) ; « Me montrer » dans le carnet le relance |
| Nouvelle carrière après une archive | `career.firstSteps` raccourci (§ 5.5) ; case « Premiers pas » décochée d'office mais modifiable |
| « Aucun » choisi puis le joueur est perdu | le carnet a tout (« à lire ») ; la ligne « À faire » reste ; Options › Accompagnement repasse en Complet sans rejouer le passé |
| Grand écran (paysage) | bulle à côté de la cible (`placeNear`), doigt identique, souris : « Cliquez » au lieu de « Touchez » (`app.isTouch`) |
| Texte 150 % sur 360 × 740 | bulle sur 3-4 lignes, défilement de la scène puis pastille (§ 11) |
| Conseil demandé par un ancien appel (`app.hints.maybe`) pendant la migration | pont : traduit en `coach.request(id, { target })` ; un identifiant sans leçon au catalogue est ignoré (avertissement en console en développement) |

---

## 14. Plan de test

**Tests Node** (`tests/coach.test.js`, logique pure de `src/ui/coach/scheduler.js` et du catalogue, sans DOM) :

- catalogue : identifiants uniques ; tout ancien identifiant de conseil (§ 1) a sa leçon ; chaque étape ≤ 90 caractères,
  ≤ 2 phrases, ≤ 12 mots par phrase (hors noms propres) ; aucune étape sans cible sauf `welcome` / `end` / lecture
  marquée ; chaque `on` cite un type d'événement connu (liste tirée des contrats) ou un signal d'interface déclaré ;
  chaque leçon a un chapitre de carnet ; aucun texte ne contient « oublié », « dépêchez », « dernière chance » ;
- file : priorités, respiration, ≤ 3 par jour, une seule active, contexte refusé (fenêtre, fête, vue, feuille sans cible
  dedans), suspension / reprise, `stillRelevant` faux → vue sans être montrée ;
- réglages : Complet / Discret / Aucun → ce qui s'affiche (tableau du § 4.7) ;
- déduction (`acquired`) sur des états minimaux : niveau 1 neuf, carrière an 1 jour 1, carrière an 6 rang 4 avec la
  Vallée, sauvegardes d'anciennes versions (fixtures existantes) — aucune exception, résultats attendus ;
- rappels : seuils, ≤ 1 par jour, ≤ 4 par saison, jamais deux fois de suite, silence après 3 ignorés, coupure par sorte ;
- **parité** : `tests/parity.test.js` inchangé et vert ; `node tools/simulate.js` identique octet pour octet ;
  `node tools/simulate-career.js` identique (l'option `starter` est désactivée par défaut côté cœur).

**Au doigt** (Playwright, Chromium, Pixel 7 et 360 × 740, toucher seulement, `index.html?debug=1&nosw`) :

1. Nouvelle carrière, Complet : premier glissé de récolte **en moins de 5 s** après la fermeture de la feuille
   « Nouvelle ferme » ; cours entier jusqu'au carnet ; la bulle ne couvre **jamais** sa cible (mesure du recouvrement à
   chaque étape) ; doigt visible sur la cible ; temps arrêté pendant les étapes de lecture (jour inchangé) ; aucune
   erreur console.
2. Même chose en 360 × 740, texte 150 %, mouvement réduit, gaucher ; puis « Je connais » dès la 1ʳᵉ bulle.
3. Niveau 1 Détente puis Classique : cours de 12 étapes, ≈ 90 mots, reprise après rechargement au milieu (étape 5).
4. Carrière avancée (sauvegarde du commit `ae003c1`) : aucun rudiment rejoué, question « Complet / Discret / Aucun »
   avec Discret présélectionné, leçons de la Vallée déjà sues marquées « à relire ».
5. Rang 2 (`__debug`) : fenêtre du rang, puis leçon « 3 nouveautés », puis boîte en fer ; pas plus de 3 leçons ce jour-là.
6. Rappels : champs mûrs laissés 1 jour → une pastille, pas deux ; ignorée 3 fois → silence jusqu'à la saison suivante ;
   Discret : ligne du résumé du matin seulement ; Aucun : rien.
7. Carnet : relire une leçon, « Me montrer » sur `career.collect` (abri plein : vrai ramassage ; abri vide : zone montrée).
8. Vue de la vallée et fête : aucune bulle étrangère ; `valley.view` et `fete.chasse` s'y affichent.
9. Cibles ≥ 48 px, textes ≥ 14 px dans la bulle, la pastille et le carnet (script de mesure existant).

---

## 15. Points à trancher (recommandation en premier)

1. **Les 6 carottes mûres du début de carrière** (E1 « sur de vraies parcelles mûres ») :
   - **A (recommandé)** : une option de création dans le cœur, `createCareer({ starter: true })`, qui pose 6 carottes
     mûres (`stage` 4, arrosées) dans l'état initial ; activée par l'interface pour une nouvelle ferme avec « Premiers
     pas », **désactivée par défaut** côté cœur (simulation et tests inchangés). Petit (≈ 20 lignes + un test),
     déterministe (aucun tirage), carrière seulement (aucun effet sur les niveaux ni la parité). C'est la seule entorse
     au « purement interface », et elle est dans l'état de **création**, pas dans l'accompagnement.
   - B : aucun changement du cœur : le tutoriel commence par semer (comme le niveau 1) et passe la 1ʳᵉ nuit à ×4 tout
     seul ; le premier glissé de récolte arrive vers 30 s, pas 5 s.
   - C : un « cadeau de Joseph » : il sème lui-même 6 carottes au jour 1 (actions de jeu appelées par l'interface) et le
     temps file jusqu'à leur maturité ; rejeté : l'accompagnement jouerait à la place du joueur.
2. **Carnet de Joseph et Guide de la ferme** :
   - **A (recommandé)** : un seul endroit, « Le carnet de Joseph », avec les segments Leçons · Mots de la ferme · Rappels
     (et les « Règles » du guide dans Mots) : un seul bouton dans le menu Pause, moins à retenir (COGA « ne pas dépendre
     de la mémoire »).
   - B : garder les deux (le guide pour les règles, le carnet pour les leçons) : deux boutons voisins, risque de doublon.
3. **Réglage par défaut des joueurs qui ont déjà joué** (mise à jour du jeu) :
   - **A (recommandé)** : leur demander une fois, avec **Discret** présélectionné (ils connaissent le jeu, mais les
     nouveautés des lots et de la Vallée leur sont montrées d'un mot).
   - B : Complet sans demander (tout le monde pareil ; plus de bulles pour un joueur expérimenté, mais les rudiments ne
     sont pas rejoués grâce au § 10.3).
   - C : Discret sans demander.

## Décisions de l'utilisateur (2026-10-04)

1. Guide : **Joseph**, petite bulle avec portrait, doigt qui montre, textes courts.
2. Présence : **montrer, puis rappeler** ; réglage Complet / Discret / Aucun.
3. Tutoriel de début de carrière **en jouant**.
4. Début de carrière : **6 carottes déjà mûres** (`createCareer({ starter: true })`, carrière seulement, sans tirage aléatoire).
5. **Carnet de Joseph et Guide de la ferme fusionnés** en un seul carnet (Leçons · Mots de la ferme · Rappels).
6. Joueurs ayant déjà une partie : **on leur demande une fois**, Discret présélectionné ; les rudiments déjà acquis ne sont jamais rejoués.
