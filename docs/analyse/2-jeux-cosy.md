# Recherche : jeux « cosy » de ferme et mécaniques à emprunter

*Rapport rédigé le 2026-10-02 pour « Une année à la ferme ». But fixé par le propriétaire : rendre le jeu **plus accessible, plus amusant, moins répétitif**.*

Méthode : recherches web (wikis, critiques, analyses de game design, conférences GDC, rapport Project Horseshoe, discussions de joueurs sur Steam, Reddit et le forum officiel de Stardew Valley), croisées avec ce que le jeu a déjà (docs/GAME_DESIGN.md, docs/CARRIERE.md). Les sources sont listées à la fin de chaque partie et regroupées au § 6.

Note sur les sources : certaines pages (Destructoid, Final Weapon, GDC schedule) ont refusé la lecture directe (403) ; leurs informations viennent alors des extraits des moteurs de recherche ou d'autres critiques. Les détails de jeu qui viennent de ma connaissance générale des titres (et non d'une page lue pendant cette recherche) sont marqués *(connaissance générale)*.

---

## Sommaire

1. Ce que dit la littérature sur le « cosy »
2. Fiches par jeu
3. Ce que les joueurs trouvent pénible (synthèse)
4. Ce que notre jeu a déjà, et ce qui manque
5. **Catalogue des mécaniques transposables** (par objectif)
6. Les 15 mécaniques les plus prometteuses, et un ordre de réalisation conseillé
7. Toutes les sources

---

## 1. Ce que dit la littérature sur le « cosy »

### 1.1 Project Horseshoe 2017 — « Coziness in Games: An Exploration of Safety, Softness, and Satisfied Needs »

Groupe de réflexion de concepteurs (dont Daniel Cook, Lost Garden / Spry Fox). C'est la première tentative sérieuse de définir le cosy. Trois piliers :

- **Sécurité** : aucune menace ni perte imminente. On peut se sentir vulnérable, mais sans conséquence grave.
- **Abondance** : les besoins de base sont couverts, donc on peut s'occuper de besoins plus hauts (appartenance, expression de soi).
- **Douceur** : signaux esthétiques doux, intimité, échelle réduite et « connaissable ».

Ce qui **détruit** le cosy, d'après le rapport (liste très utile pour nous) :
- les récompenses **extrinsèques** qui rendent tout transactionnel ;
- le danger, la peur ;
- la **responsabilité** : l'entretien non optionnel, la « charge émotionnelle » ;
- les distractions désagréables (notifications, rappels insistants) ;
- les stimulations intenses (flash, bruit soudain) ;
- les grandes distances (monde trop grand pour être connu) ;
- la présence sociale non consentie ;
- la tromperie, l'insincérité ;
- l'opulence, la comparaison sociale.

Exemple donné : la fenêtre surgissante (pop-up) cumule presque tous ces défauts à la fois (stimulus intense, nouvelle responsabilité, interruption, peur de rater, marketing).

Règles mécaniques recommandées :
- **activités plaisantes en elles-mêmes** (secouer un arbre dans Animal Crossing), indépendamment de la récompense ;
- **largeur d'activités optionnelles** : « toutes peuvent être ignorées sans mauvaise conséquence » ;
- **rituels sûrs** : gestes répétés, familiers, bornés, qui occupent les mains et libèrent l'esprit (ranger, collectionner, entretenir par choix) ;
- **agence** : le joueur choisit ;
- surveiller quand les joueurs « optimisent » un système charmant jusqu'à le rendre transactionnel, et rééquilibrer pour que le comportement confortable reste le meilleur ;
- monétisation : pas de FOMO, pas de rareté artificielle, cosmétiques discrets.

Ingrédients esthétiques : abondance visible (nourriture, chaleur), transitions douces, signaux de protection (animaux détendus, personnage gardien), mondanité (cadre familier), refuge (le dehors est un peu inconfortable : pluie, froid), **saisons et rituels**, accueil explicite. Personnages « tend and befriend » : des nourriciers qui donnent sans transaction ; inclure aussi un grincheux pour l'authenticité. Récits « ambiants » : épisodiques plutôt qu'un grand climax, archétypes « il faut tout un village », « retour au pays », « fuite pastorale », « travail honnête ».

Intérêt pour nous : Joseph est exactement le personnage « gardien nourricier » du rapport ; la faillite brutale et l'entretien obligatoire sont exactement ce que le rapport déconseille (le mode Détente va déjà dans ce sens).

### 1.2 Daniel Cook (Lost Garden, Spry Fox — Cozy Grove)

- Les personnages et le décor servent d'**entrée** vers les mécaniques ; « les ours mignons couvrent le fait qu'on fait quelque chose de mécaniquement étrange ».
- Éviter le contenu coûteux utilisé une seule fois ; préférer des **systèmes réutilisables** et des générateurs (variété à faible coût).
- Rejeter les puzzles bloquants et les boucles « échouer, recommencer » : rien ne doit laisser le joueur coincé.

### 1.3 Unpacking (Witch Beam, GDC 2022)

- Trois piliers : **contemplation, découverte, expression**.
- **Aucun score, aucune limite de temps, aucun échec**, et pourtant plus d'un million d'exemplaires et plus de 20 prix ; jouable « de 5 à 75 ans ».
- **Conception soustractive** : « Mon jeu a-t-il vraiment besoin de cette fonction, ou est-ce un bagage hérité du genre ? »
- 14 000 bruitages enregistrés : chaque objet posé « claque » avec un son propre à sa matière ; le son donne la sensation physique qui définit le jeu.

### 1.4 « Juice it or lose it » (Jonasson et Purho, 2012)

Le « jus » : ce qui rebondit, gicle, gigote et fait de petits bruits mignons ; « un maximum de retour pour un minimum d'action ». Techniques : interpolations avec accélération (easing), écrasement et étirement, particules, sons, couleur, petites secousses. Pour un jeu cosy : garder le jus mais **doux** (pas de secousse forte, cf. Project Horseshoe sur les stimulations intenses) et toujours désactivable (option « animations réduites », déjà présente chez nous).

**Sources § 1** :
- https://www.projecthorseshoe.com/reports/featured/ph17r3.htm
- https://pixelpoppers.com/link/d64e95/group-report-coziness-in-games-an-exploration-of-safety-softness-and-satisfied-needs/
- https://lostgarden.com/2023/07/08/what-is-a-daniel-cook-game/
- https://www.gamedeveloper.com/design/unpacking-the-design-pillars-of-a-chill-puzzle-game
- https://www.gdcvault.com/play/1029400/-Unpacking-Zen-Designing-a
- https://blog.audiokinetic.com/en/unpacking-the-fun-behind-the-foley/
- https://roblog.co.uk/2024/03/juicy-games/
- https://www.vice.com/en/article/cozy-games-yoshi-animal-crossing

---

## 2. Fiches par jeu

Chaque fiche : boucle principale · contre la répétition · accessibilité et prise en main · rythme des récompenses · retours et « jus » · social · motivations sans argent · ce qui lasse.

### 2.1 Stardew Valley (PC, consoles, mobile)

- **Boucle** : journée limitée (horloge + énergie) → arroser, récolter, s'occuper des animaux, puis choisir une activité (mine, pêche, social, fourrage) → dormir, vendre via le **coffre d'expédition** (l'argent tombe la nuit).
- **Contre la répétition** :
  - **Automatisation progressive** : arroseurs dès le niveau 2 d'agriculture (« si on passe tout en arroseurs, on n'arrose plus jamais à la main »), puis **huttes de Junimos** qui récoltent dans un carré 17 × 17. Les joueurs le décrivent comme un choix « temps contre argent » ; ceux qui aiment arroser n'achètent simplement pas les arroseurs.
  - **Qualité des récoltes** (normal, argent, or, iridium) : fixée à la récolte, améliorée par l'engrais et le niveau ; vaut plus cher et compte plus en cadeau.
  - **Centre communautaire** : des « paquets » (bundles) à remplir avec une de chaque chose (récoltes de chaque saison, poissons, produits d'atelier…). Conçus pour **ne pas être une corvée** mais pour pousser à essayer toutes les facettes du jeu. Chaque salle complétée se restaure visuellement et débloque quelque chose de concret (serre, réparations, bus…).
  - **Festivals** à dates fixes (8 par an : chasse aux œufs, danse des fleurs, Luau avec soupe commune, méduses, foire avec étal jugé sur 9 objets — qualité et diversité —, Esprit d'Halloween avec labyrinthe, fête de l'Étoile d'hiver avec cadeau secret, marché de nuit).
  - **Événements nocturnes au hasard** : fée qui fait mûrir un carré 5 × 5 (1 %), météorite (1 %), sorcière, chouette de pierre (0,5 %), capsule étrange (une fois par partie), tempête…, et annonce du lendemain dans le message du matin.
  - **Tableau d'annonces** quotidien (« Help Wanted ») : une demande aléatoire, 2 jours pour la faire ; 5 types (livrer, collecter, pêcher, tuer, trouver) ; 10 et 40 demandes = succès + lettre du maire avec de l'argent. Plus tard, **commandes spéciales** collectives.
  - Musée (minéraux, artéfacts), recettes de cuisine, pêche avec mini-jeu, secrets (noix dorées, notes secrètes).
- **Évaluation de grand-père** : au début de l'année 3, l'esprit du grand-père juge les deux premières années sur 21 points (gains, niveaux, succès, amitiés, centre communautaire) et allume **1 à 4 bougies** ; 12 points → statue de la perfection qui produit chaque jour. On peut repasser l'évaluation en déposant un diamant. Bel exemple de **bilan narratif avec seconde chance**.
- **Accessibilité** : pas d'échec définitif, mais énergie et horloge mettent la pression en année 1 (« trop de cultures et on finit au bord de l'évanouissement après l'arrosage »). Mobile : tap-to-move, 8 schémas de contrôle, attaque automatique ; la mine au doigt reste critiquée.
- **Récompenses** : court (récolte du jour, poisson), moyen (paquet, saison, outil amélioré), long (centre communautaire, évaluation, perfection).
- **Social** : coopératif jusqu'à 8 ; amitié par cadeaux, cœurs, scènes.
- **Ce qui lasse** : arrosage manuel et énergie en année 1 ; à partir de l'automne de l'année 2, « la routine : vérifier les arbres, les fûts, les bocaux, la serre, puis se recoucher » ; « une fois l'argent sans usage et les outils au max, plus rien à faire » ; beaucoup recommencent une nouvelle ferme. Leçon : **les objectifs doivent continuer à exister** et l'argent doit avoir des usages tardifs.

### 2.2 Story of Seasons / Harvest Moon (dont Pioneers of Olive Town, et Harvest Moon: Home Sweet Home sur mobile)

- **Boucle** classique : cultures, animaux, outils, villageois, festivals de saison.
- **Contre la répétition** : festivals et **concours** (récoltes, animaux, cuisine) ; qualité des produits ; dans Olive Town, beaucoup de fabrication — mais les machines n'acceptent qu'un objet à la fois, et les critiques disent qu'on passe son temps « garé devant les machines » ; Olive Town a aussi **retiré** les concours de récoltes et d'animaux, ce que les fans ont regretté. Leçon : les concours de ferme sont aimés ; la micro-gestion des machines ne l'est pas.
- **Harvest Moon: Home Sweet Home** (2024, mobile **premium à 17,99 $**, sans achat intégré d'après TouchArcade) : thème de **revitalisation du village** d'Alba, quêtes des habitants, chapitres d'histoire ; contrôles tactiles toucher-glisser bien faits ; critiques : 30 i/s, chargements, pas de vibration haptique. Village « dense et cosy » plutôt que vide.
- **Ce qui lasse** : allers-retours, fabrication un par un, contrôles imprécis.

### 2.3 Animal Crossing: New Horizons

- **Boucle** : horloge **réelle** ; chaque jour : fossiles, arbres à fruits, roches, ventes du magasin, visiteurs ; aménagement libre de l'île.
- **Contre la répétition** :
  - **limites douces quotidiennes** (fossiles, arbres, fleurs une fois par jour) : le jeu est conçu pour être « moins amusant » si on le joue d'une traite ;
  - **Miles Nook+** : 5 petites tâches renouvelées dès qu'on en finit une (« attraper 3 papillons », « vendre des fruits »), certaines **×2 ou ×5** ; plus un carnet de défis à long terme (Miles Nook). Paradoxe noté par Pixel Poppers : semble encourager à jouer sans fin, mais comme les Miles s'accumulent vite, le joueur finit par poser la console « jusqu'à demain » ;
  - **visiteurs du jour** (marchands, personnages spéciaux), **fêtes saisonnières**, cours du navet le dimanche (la « bourse aux navets ») ;
  - **musée** : on apporte bestioles, poissons, fossiles à Blathers qui raconte un fait sur chaque don ; la tente devient un vrai bâtiment après assez de dons ; salles qui se remplissent ; le **Critterpedia** montre ce qui est disponible maintenant et ce qui manque.
- **Accessibilité** : « rien n'est minuté, rien ne peut mal tourner » ; aucun rôle imposé, on passe librement de la déco au jardinage. Très cité pour son effet sur le moral pendant le confinement (routine, structure).
- **Récompenses** : court (une bestiole, un don), moyen (nouvelle boutique, nouvel habitant), long (étoiles de l'île, musée complet).
- **Social** : visites d'îles, échanges, photos.
- **Ce qui lasse** : terraformage lent, fabrication un par un, menus répétitifs (dialogue de Tom Nook) *(connaissance générale)*.

### 2.4 Animal Crossing: Pocket Camp (mobile, puis Pocket Camp Complete hors ligne en 2024)

- Conçu pour **sessions courtes** au téléphone ; contrôles très simplifiés.
- **Boucle** : des animaux campent dans des zones ; chacun a **3 demandes** (bestiole, fruit, poisson, coquillage) ; on donne, on gagne clochettes, matériaux, **points d'amitié** ; à assez d'amitié, l'animal vient au camping si on a construit les meubles qu'il aime. Demandes renouvelées après ~3 h.
- **Leçon** : le cycle « petite demande → récompense → amitié qui monte → débloque un meuble ou un visiteur » marche très bien en portrait et une main. Les minuteurs de fabrication et la monétisation ont été critiqués *(connaissance générale)*.

### 2.5 Fields of Mistria (2024, accès anticipé puis 1.0)

- **Boucle** Stardew-like ; le village a subi un tremblement de terre : la **réputation du village** (renommée, 100 niveaux nommés Bois → Pierre → … → Mistril) monte en expédiant des produits, en donnant au musée et en faisant les demandes du tableau ; **chaque niveau donne une petite récompense** (bourse, meuble, potion d'endurance) à récupérer dans un coffre près du tableau.
- **Musée** : collections de 5 objets, bonus de renommée par collection complète.
- **Magie** : un sort de pluie remplace les arroseurs.
- **Accessibilité cognitive** (Can I Play That? très positif) : **quêtes sans limite de temps** ; pénalités douces (s'évanouir ou trop dormir coûte peu, aucune perte d'objet) ; écran du matin qui rappelle anniversaires et événements ; **carnet qui mémorise les goûts des habitants** ; carte avec portraits ; option **« vitesse de la journée » plus lente** ; zoom de l'interface ×6 ; désactiver secousses, flashs, particules de météo ; options pour les sons de mastication (misophonie) ; appuis longs remplaçables par des appuis répétés. Critiques : tutoriels affichés une seule fois sans possibilité de les relire ; surbrillance des objets trop discrète.

### 2.6 Farm Together (Milkstone)

- Ferme en temps réel, **même hors ligne** ; **aucune énergie** ; cultures qui **ne meurent pas** si on les néglige ; jamais de difficulté financière. Arroser ou nourrir accélère un peu.
- Des centaines de choses à débloquer (cultures, animaux, bâtiments, terrains d'extension) ; **puits à souhaits** pour revenu passif ; coopératif jusqu'à 16 avec permissions (« récolter seulement », « planter et récolter »).
- **Ce qui lasse** : on lui reproche répétitivité et manque de profondeur — l'absence totale d'enjeu enlève aussi du sel. Leçon : **sans aucune tension, l'intérêt baisse** ; garder un léger enjeu (objectif, concours) mais jamais punitif.

### 2.7 Cozy Grove (Spry Fox, Apple Arcade puis consoles)

- Île hantée **en temps réel** ; chaque jour, les esprits-ours donnent quelques tâches ; en les aidant, **la couleur revient** dans le monde (retour visuel progressif très fort).
- **Contenu limité par jour** : au bout d'une vingtaine de minutes, le jeu dit qu'on peut s'arrêter et revenir demain (on peut continuer à se promener et collectionner). David Edery : il s'agit de « rythmer le contenu narratif pour une expérience épisodique sur des mois », comme une série.
- **Feu de camp** = personnage, maison, garde-robe, cuisinier : on y jette des objets qui se transforment.
- Collection du capitaine (musée).
- **Ce qui lasse** : la limite quotidienne divise (respect du temps pour les uns, frustration pour les autres) ; fabrication très simple.

### 2.8 Wylde Flowers (Studio Drydock, Apple Arcade — jeu de l'année Apple Arcade 2022)

- Vie de sorcière à la campagne ; **histoire continue entièrement doublée**, qui avance au rythme du joueur (37 à 80 h).
- Gameplay « peu exigeant », sans doute pour l'accessibilité et le mobile ; magie et potions ; fourrage pour la fabrication.
- **Ce qui lasse** : ceux qui aiment la simulation trouvent la production trop contrainte. Leçon : une **histoire en épisodes** et des personnages forts compensent une simulation simple.

### 2.9 Sun Haven

- Trois villes, trois monnaies, trois fermes, beaucoup de fabrication.
- **Ce qui lasse** : « on se retrouve avec plusieurs fermes alors qu'on a à peine profité de la première », « trop de micro-gestion », « gonflement de la fabrication ». Leçon pour notre Carrière : **ne pas multiplier les terrains et systèmes plus vite que le joueur ne les apprécie** ; chaque extension doit avoir le temps d'être savourée.

### 2.10 Coral Island

- **Rang du village** de F à S : monte avec le musée, l'océan et le temple ; chaque rang débloque **de nouvelles cultures et bêtes** → « une raison d'attendre les saisons de l'année suivante ».
- **Ce qui lasse** : le nettoyage de l'océan (des heures à ramasser des déchets avant que l'histoire commence) est jugé monotone. Leçon : **une corvée longue placée devant le contenu intéressant est le pire endroit pour une corvée**.

### 2.11 Littlewood

- Après la victoire contre le méchant, on reconstruit le village. **Pas d'horloge** : seules les actions qui font progresser une compétence remplissent une barre d'énergie ; marcher et parler sont gratuits.
- Placement des maisons, demandes des habitants sur leur environnement ; jeu de cartes « Tarott » à côté.
- Leçon : **le temps ne passe que quand on agit** — aucune pression d'horloge, et une journée qui reste bornée.

### 2.12 Ooblets

- Ferme + collection de créatures + combats de danse (cartes). Critiques : **progression lente et répétitive**, cercle vicieux en début de partie (il faut des Ooblets pour gagner des ressources et des ressources pour avoir des Ooblets) ; « ne respecte pas le temps du joueur ». Leçon : éviter les boucles d'interdépendance qui bloquent le début.

### 2.13 Hay Day (Supercell, mobile — référence de la ferme tactile)

- Chaîne d'approvisionnement : cultures → machines → produits → **tableau de commandes** (camion), **bateau** (gros lot à remplir), clients qui passent à la ferme, étal au bord de la route.
- Analyse Deconstructor of Fun : concepts **logiques**, pas de tutoriel forcé, pas de quêtes au départ ; on apprend en faisant ; pensé pour le grand écran tactile ; mises à jour qui renforcent la boucle au lieu de la disperser.
- Leçon : le **tableau de commandes** (3 à 9 commandes visibles, on choisit lesquelles honorer, on peut en jeter une) est la mécanique de variété la plus efficace du genre sur téléphone.

### 2.14 Rusty's Retirement (2024, 96 % d'avis positifs)

- Ferme **idle** qui tient dans une bande en bas de l'écran ; le joueur donne quelques ordres, les **robots** prennent en charge arrosage, plantation, transport ; les nouvelles cultures poussent plus longtemps mais rapportent plus.
- Leçon : l'automatisation **visible** (de petits robots qui font le travail) est un plaisir en soi ; regarder sa ferme tourner seule est satisfaisant. C'est déjà la direction de notre Carrière (employés, machines).

**Sources § 2** (voir aussi § 7) :
- Stardew : https://www.stardewvalley.net/?p=875 · https://strategywiki.org/wiki/Stardew_Valley/Community_Centre · https://wiki.stardewvalley.net/Crops · https://stardewvalleywiki.com/Festival · https://stardewvalleywiki.com/Grange_Display · https://stardewvalleywiki.com/Random_Events · https://stardewvalleywiki.com/Help_Wanted · https://www.stardewvalleywiki.com/Special_Orders · https://stardewvalleywiki.com/Grandpa%27s_Evaluation · https://stardewvalleywiki.com/Mobile_Controls · https://www.pocketgamer.com/articles/079085/stardew-valley-review/ · https://forums.stardewvalley.net/posts/221293/ · https://steamcommunity.com/app/413150/discussions/0/357284131788423175 · https://forums.stardewvalley.net/threads/having-a-problem-with-motivation-need-help.2715/latest · https://strategywiki.org/wiki/Stardew_Valley/Later_Years · https://www.npr.org/2025/01/24/g-s1-44510/the-legacy-and-future-of-the-farming-game-stardew-valley
- Story of Seasons / Harvest Moon : https://rpgsite.net/review/11080-story-of-seasons-pioneers-of-olive-town-review · https://nintendolife.com/reviews/nintendo-switch/story_of_seasons_pioneers_of_olive_town · https://toucharcade.com/?p=328143 · https://finalweapon.net/2024/12/23/harvest-moon-home-sweet-home-review-android/
- Animal Crossing : https://pixelpoppers.com/2020/03/nook-miles-and-binge-playing/ · https://www.thegamer.com/animal-crossing-new-horizons-complete-guide-nook-miles/ · https://www.tuni.fi/playlab/?p=10347 · https://www.fandom.com/articles/time-traveling-animal-crossing · https://kotaku.com/i-love-animal-crossing-new-horizons-museum-1842798339 · https://nookipedia.com/wiki/Museum
- Pocket Camp : https://www.techradar.com/news/animal-crossing-pocket-camp-everything-you-need-to-know-about-the-mobile-game · https://www.pocketgamer.com/animal-crossing-pocket-camp/animal-crossing-pocket-camp-tips-and-tricks-maxing-friendship-levels-filling-you/ · https://destructoid.com/?p=208519
- Fields of Mistria : https://caniplaythat.com/?p=18295 · https://destructoid.com/?p=572633 · https://deltiasgaming.com/?p=173455 · https://gamingtrend.com/impressions/fields-of-mistria-early-access-impressions-sailor-moon-goes-farming
- Farm Together : https://www.gameinformer.com/review/farm-together/stress-free-crop-growing-fun · https://www.xboxtavern.com/farm-together-review/
- Cozy Grove : https://broadly.vice.com/en/article/bvx9vw/cozy-grove-is-ok-telling-players-to-log-off-its-delightful · https://siliconera.com/?p=876221 · https://gamecritics.com/cody-bolster/cozy-grove-review/ · https://www.pockettactics.com/cozy-grove/review
- Wylde Flowers : https://www.pockettactics.com/wylde-flowers/review · https://cozygamereviews.com/wylde-flowers-review/ · https://www.pockettactics.com/wylde-flowers/app-store-awards
- Sun Haven : https://metaphorsandmoonlight.com/game-review-sun-haven-by-pixel-sprout-studios/ · https://gameluster.com/review-sun-haven-a-star-within-its-field/
- Coral Island : https://checkpointgaming.net/reviews/2023/11/coral-island-review-coasting-by/ · https://cozygamereviews.com/coral-island-review/ · https://commonsensegamer.com/coral-island-how-to-increase-town-rank-fast/
- Littlewood : https://nintendowire.com/reviews/littlewood/ · https://gameluster.com/review-littlewood-the-peaceful-rpg/ · https://kotaku.com/littlewood-is-a-game-about-rebuilding-your-town-after-y-1834517443
- Ooblets : https://gameinformer.com/review/ooblets/a-cheerful-grind · https://nintendoworldreport.com/review/61370
- Hay Day : https://www.deconstructoroffun.com/blog//2013/01/behind-success-of-hay-day.html · https://gamedeveloper.com/business/game-monetization-design-analysis-of-hay-day
- Rusty's Retirement : https://en.wikipedia.org/wiki/Rusty%27s_Retirement · https://aiptcomics.com/2024/05/13/rustys-retirement-idle-game-review

---

## 3. Ce que les joueurs trouvent pénible (synthèse)

| Irritant | Où on le voit | Ce que ça veut dire pour nous |
|---|---|---|
| Arrosage manuel de dizaines de cases | Stardew an 1 | Notre glisser-arroser aide ; l'automatisation doit arriver tôt et être « visible et mignonne ». |
| Énergie qui coupe la journée | Stardew an 1, débats Steam | On n'a pas d'énergie : ne surtout pas en ajouter. |
| Routine identique chaque jour | Stardew an 2+, Farm Together | Il faut des **éléments qui changent chaque jour ou chaque saison** (demandes, visiteurs, météo spéciale, cours). |
| Plus d'objectif / argent inutile | Stardew an 3 | Objectifs de collection, buts « pour la beauté », puits d'argent agréables (décor, village). |
| Corvée longue devant le contenu | Coral Island (océan) | Jamais de corvée en porte d'entrée. |
| Trop de systèmes trop vite | Sun Haven | Débloquer progressivement, savourer chaque nouveauté (déjà les rangs). |
| Fabrication un par un, machines à nourrir | Olive Town, AC:NH | Nos ateliers automatiques (« la récolte part à l'atelier ») sont déjà la bonne réponse. |
| Boucle d'interdépendance au départ | Ooblets | Toujours une action rentable disponible. |
| Limite quotidienne frustrante | Cozy Grove | Si on ajoute des limites, les rendre généreuses et non bloquantes. |
| Tutoriel non relisable | Fields of Mistria | Un « guide de la ferme » consultable. |
| Pression du temps qui fait rater | nos propres retours joueurs (« une saison pour planter 10 patates… c'était déjà trop tard ») | Pause automatique sur les moments clés, vitesse lente, délais qui ne courent qu'après acceptation (déjà fait pour Joseph). |

---

## 4. Ce que notre jeu a déjà, et ce qui manque

**Déjà là** (d'après GAME_DESIGN.md et CARRIERE.md) : saisons accélérées et vitesse réglable, météo avec prévision, cultures par saison, gel, arbres, ateliers automatiques sans file d'attente, investissements à revenu quotidien, mode Détente avec prêt de Joseph, 12 niveaux à contraintes, étoiles et bonus permanents, 26 succès, décoration en écus, concours du village (niveau 12) ; Carrière : terrains, rangs, employés, machines, 8 animaux, 4 fêtes + comice, événements au hasard (corbeaux, visiteurs, arc-en-ciel…), quêtes et amitié de Joseph, Carnet, bilan annuel.

**Ce qui manque surtout** (là où la concurrence fait mieux) :
1. **Collection** : rien à « compléter » par plaisir (herbier, album, musée).
2. **Qualité / exceptionnel** : chaque récolte d'une culture vaut toujours pareil ; pas de « belle surprise » à la récolte.
3. **Demandes courtes et renouvelées** (tableau de commandes, petites envies du jour) : les quêtes de Joseph sont volontairement rares.
4. **Restauration visible d'un lieu commun** (village, centre communautaire) qui donne un but collectif au long cours.
5. **Mini-activités** qui cassent le rythme (pêche, cueillette, cuisine).
6. **Récit et personnages** au-delà de Joseph (un petit village avec 4 ou 5 voisins).
7. **Surprises rares** et secrets à découvrir.
8. **Accessibilité** : vitesse plus lente que ×1, pauses automatiques, guide relisable, rappels du matin.

---

## 5. Catalogue des mécaniques transposables

Légende — **Effort** : S = quelques heures à 1 jour ; M = quelques jours ; L = une semaine ou plus (données, logique, interface, rendu, tests, équilibrage). **Risque** : ce qui peut mal tourner. Toutes sont pensées pour : portrait, une main, sessions courtes, détente.

### 5.A Moins de répétition

**A1. Tableau des commandes du village** — *Hay Day (camion, bateau), Stardew (Help Wanted), Pocket Camp (demandes des animaux), Fields of Mistria (tableau)*
- **Quoi** : un panneau à l'entrée de la ferme montre 3 commandes (« 6 carottes + 2 confitures → 120 pièces + 1 ♥ », « 3 œufs pour la boulangère »). On livre d'un toucher depuis le stock ou dès qu'on récolte ; on peut **jeter** une commande pour en tirer une autre (gratuit, une fois par jour). Nouvelles commandes à l'aube.
- **Pourquoi** : donne un but à court terme qui change chaque jour, fait planter des cultures variées (au lieu de toujours la plus rentable), et c'est un geste unique d'un pouce.
- **Chez nous** : Niveaux — une commande par jour à partir du niveau 2 ; Carrière — tableau à 3 places (les « commandes des visiteurs » existent déjà : les regrouper sur un panneau visible dans la scène). Prix = valeur marchande × 1,3 à 1,6 ; les commandes ne demandent que des produits **possibles** avec la ferme actuelle.
- **Effort** : M. **Risque** : devenir une liste de corvées si trop de commandes ; garder 3 au maximum, aucune expiration (ou longue), jamais de pénalité.

**A2. Qualité des récoltes : belles récoltes et récolte d'or** — *Stardew (argent/or/iridium), Story of Seasons*
- **Quoi** : à chaque récolte, une petite chance de « **belle** » (×1,5, étoile argentée) ou « **d'or** » (×2, étoile dorée + petit son brillant). Les chances montent avec un sol bien entretenu (arrosé chaque jour de la pousse, pas de sol fatigué, ruches à proximité, compost en Carrière).
- **Pourquoi** : récompense variable (le petit frisson du « peut-être »), donne une raison d'arroser soi-même même avec l'arrosage automatique, nourrit les concours et collections.
- **Chez nous** : 3 niveaux seulement, lisibles par une étoile au-dessus du « +12 ». En simulation, l'espérance doit rester modeste (+5 à +8 % de revenu) pour ne pas casser l'équilibre.
- **Effort** : S (logique + texte flottant) à M (avec bonus de sol et tests d'équilibre). **Risque** : complexité de l'aide ; garder la règle en une phrase.

**A3. Envies du jour (petits défis renouvelés)** — *Miles Nook+ (Animal Crossing), Littlewood (demandes), Fields of Mistria*
- **Quoi** : 3 petites envies optionnelles affichées dans le Carnet / le Bilan : « Récolter 5 navets », « Arroser à la main 10 parcelles », « Acheter une ruche », « Vendre sous la pluie ». Chaque envie rapporte quelques écus ; une est parfois « ×2 ». Une envie faite est remplacée à l'aube suivante (pas tout de suite, pour éviter de jouer sans fin).
- **Pourquoi** : casse la routine en suggérant des gestes différents ; récompense douce, jamais obligatoire.
- **Chez nous** : générateur de modèles (`{verbe} {N} {objet}`) filtré par ce qui est possible ; écus = monnaie décorative déjà existante.
- **Effort** : M. **Risque** : glisser vers le « travail » extrinsèque dénoncé par Project Horseshoe ; récompenses faibles, discrètes, pas de notification.

**A4. Visiteurs et marchands ambulants du jour** — *Animal Crossing (Label, Flick, Racine…), Stardew (marchande du vendredi), Pocket Camp*
- **Quoi** : certains jours, un personnage s'arrête au portail : marchand de graines rares (une culture hors liste, ex. melon, potiron géant), brocanteur de décorations, touriste qui achète une récolte précise très cher, enfant qui demande une fleur. Toucher le personnage → petite feuille, 2 boutons.
- **Chez nous** : la Carrière a déjà des visiteurs ; à étendre avec un **calendrier semi-fixe** (le marchand passe toujours le jour 5 de chaque saison) pour créer l'attente, et l'ajouter aux Niveaux (1 visite par saison).
- **Effort** : M. **Risque** : interruptions ; jamais de pause forcée, le visiteur attend jusqu'au soir.

**A5. Cultures géantes et variétés rares** — *Stardew (cultures géantes), Coral Island, Story of Seasons*
- **Quoi** : quand un carré 2 × 2 (ou 3 × 3) de la même culture mûrit ensemble, petite chance qu'elles fusionnent en **citrouille / chou géant** (vaut ×6, reste visible, sujet de photo). Graines rares (tomate cerise dorée, maïs bleu) via visiteurs ou commandes.
- **Pourquoi** : surprise visuelle très mémorable, incite à planter en blocs.
- **Chez nous** : notre grille de parcelles 2 × 2 tuiles s'y prête ; sprite géant à produire (32 × 32).
- **Effort** : M (logique S + graphisme). **Risque** : faible ; vérifier la licence ou dessiner le sprite.

**A6. Météos et jours spéciaux rares** — *Stardew (pluie verte, tempêtes, jour de vent), Animal Crossing (étoiles filantes, arc-en-ciel)*
- **Quoi** : 1 ou 2 jours rares par an : **pluie d'été chaude** (pousse ×2), **brouillard** (champignons à cueillir), **vent d'automne** (feuilles qui tombent, ruches +), **nuit d'étoiles filantes** (toucher une étoile = un vœu : petit bonus aléatoire), **première neige** annoncée.
- **Chez nous** : table météo existante + 3 entrées rares ; effets de particules déjà là.
- **Effort** : S à M. **Risque** : déséquilibre minime si bonus faibles.

**A7. Rotation et association des cultures** — *agriculture réelle ; « sol fatigué » déjà chez nous*
- **Quoi** : bonus doux plutôt que malus : planter une légumineuse (haricot, pois) après une culture gourmande donne « sol reposé » (+qualité) ; fleurs (tournesol) à côté des légumes = +pollinisation.
- **Pourquoi** : transforme une contrainte en petit puzzle positif ; varie les semis.
- **Effort** : M. **Risque** : complexité ; afficher seulement des badges positifs (« +qualité ») dans la feuille des graines.

**A8. Plan de culture enregistré et « Semer comme hier »** — *Farm Together (semis en zone), Rusty's Retirement*
- **Quoi** : un bouton « Resemer comme avant » après récolte, et des modèles de plan (déjà en Carrière). Réduit les gestes répétitifs plutôt que d'ajouter du contenu.
- **Effort** : S. **Risque** : aucun.

### 5.B Plus de fun et de surprise

**B1. Album de la ferme / herbier (collection)** — *Musée d'Animal Crossing (Blathers), Critterpedia, musée de Mistria (sets de 5), collection du capitaine (Cozy Grove), Stardew (collections)*
- **Quoi** : un **album** avec une case par chose : chaque culture (et sa version d'or), chaque produit d'atelier, chaque animal, chaque météo rare, chaque visiteur, chaque culture géante, chaque fête. Une case se remplit la première fois (illustration + une phrase drôle ou instructive « Le navet résiste au gel : il passe l'hiver sous la neige »). **Pages de 5 à 8 cases** : page complète = récompense (décoration, écus, petite amélioration).
- **Pourquoi** : plaisir de compléter sans pression, s'applique à **tout** le contenu existant (réutilisation, cf. Daniel Cook), fil conducteur entre Niveaux et Carrière.
- **Chez nous** : partagé entre modes (comme les écus) ; onglet de la Grange aux souvenirs. Pastille « Nouveau ! » discrète.
- **Effort** : M (données + écran ; les sprites existent déjà). **Risque** : faible ; ne pas mettre de cases impossibles à trouver sans guide (afficher un indice flou « Une culture d'été qui aime le soleil… »).

**B2. Restauration du village (paquets façon Centre communautaire)** — *Stardew (bundles), Fields of Mistria (réparations), Harvest Moon Home Sweet Home (revitalisation d'Alba), Cozy Grove (la couleur revient), Coral Island (rang du village)*
- **Quoi** : au bas de la carte (ou en haut, dans la colonne de terrains), le **village** voisin est un peu abandonné : le lavoir, la boulangerie, la place, l'école, la gare. Chaque lieu demande un **panier** de dons variés (« 1 produit de chaque saison », « 3 confitures différentes », « un œuf, un fromage, une laine »). Panier rempli → le lieu se répare **visiblement** (animation, couleurs, habitants qui reviennent) et offre un avantage concret (la boulangerie achète le pain +20 %, la gare amène des touristes, l'école donne des stagiaires…).
- **Pourquoi** : objectif à long terme qui pousse à **essayer toutes les facettes** (le but avoué des bundles de Stardew), récit « il faut tout un village » (Project Horseshoe), et vrai puits de production pour la fin de Carrière quand l'argent ne sert plus.
- **Chez nous** : Carrière d'abord (s'étale sur plusieurs années, se marie avec les rangs et Joseph) ; version courte en Niveaux possible (un lieu par niveau, niveau 12 le village).
- **Effort** : L (données, logique, écran des paniers, rendu du village par états). **Risque** : coût graphique ; conception soignée pour ne pas exiger d'objets trop rares (Stardew tolère des paquets « au choix 4 sur 6 », à reprendre).

**B3. Fêtes avec mini-jeu d'un pouce** — *Stardew (chasse aux œufs, Luau, foire), Story of Seasons (concours), Animal Crossing (fêtes saisonnières)*
- **Quoi** : chaque fête du calendrier devient une **petite scène de 30 à 60 s** facultative : printemps — chasse aux œufs (toucher les œufs cachés dans la scène) ; été — soupe commune (choisir un ingrédient, réaction des villageois selon la qualité) ; automne — étal jugé (choisir 6 produits : qualité + diversité, cf. foire de Stardew) ; hiver — cadeau secret pour un voisin. Récompense : écus, décoration de fête, case d'album.
- **Pourquoi** : rupture de rythme, rituel saisonnier (pilier cosy), souvenir partagé.
- **Chez nous** : les 4 fêtes et le comice existent (bonus de vente) ; ajouter le mini-jeu comme bouton « Participer » dans le bandeau ; jamais obligatoire, jamais d'échec (on gagne toujours au moins un lot).
- **Effort** : M par mini-jeu (L pour les 4). **Risque** : demander des réflexes ; choisir des jeux **sans chrono** ou très tolérants.

**B4. Surprises nocturnes rares** — *Stardew (fée, météorite, chouette, capsule), Animal Crossing*
- **Quoi** : à l'aube, très rarement (0,5 à 2 % par nuit), un événement **positif** et visible : la fée fait mûrir un carré 3 × 3 ; une étoile tombée (objet de décor unique) ; un renard dort dans la grange (adoptable comme animal de compagnie) ; un épouvantail mystérieux ; un ancien coffre trouvé en bêchant. Annonce dans le message du matin, case d'album.
- **Pourquoi** : « tout peut arriver » en restant sûr (aucun malheur aléatoire en Détente).
- **Chez nous** : le flux `events` existe ; ajouter des événements rares de l'aube, aussi en mode Niveaux (sans changer l'équilibre : effets minimes).
- **Effort** : S à M. **Risque** : faible.

**B5. Secrets et petites énigmes** — *Stardew (notes secrètes, noix dorées), Animal Crossing*
- **Quoi** : quelques secrets à découvrir en jouant : toucher 3 fois l'épouvantail, planter des tournesols en cœur, récolter une culture d'or un jour d'arc-en-ciel, nommer sa ferme d'un nom spécial… Récompense : décoration cachée, dialogue de Joseph, succès « secret ». Joseph donne parfois un indice (« Mon grand-père disait que… »).
- **Effort** : S par secret. **Risque** : aucun si les secrets ne donnent que du cosmétique.

**B6. Cuisine / recettes de la maison** — *Stardew, Story of Seasons, Cozy Grove (feu de camp), Animal Crossing*
- **Quoi** : la cuisine de la maison accepte 2 ou 3 ingrédients (« carotte + chou → soupe paysanne »). Une recette découverte entre dans l'album ; un plat donne un **petit bonus d'un jour** (pousse +10 %, employés joyeux) ou s'offre à Joseph et aux voisins (♥), ou se vend à la fête.
- **Pourquoi** : expérimentation (on devine les combinaisons), donne de l'intérêt aux petites récoltes, collection.
- **Chez nous** : peut réutiliser le principe des ateliers ; interface « deux cases + bouton Cuisiner ».
- **Effort** : M. **Risque** : chevauchement avec les ateliers ; positionner la cuisine sur « bonus et cadeaux », pas sur la vente.

**B7. Pêche ou cueillette détente à la mare / forêt** — *Stardew, Animal Crossing, Fields of Mistria*
- **Quoi** : mini-activité d'un toucher : lancer la ligne, attendre la touche (vibration), toucher → poisson ; aucune défaite (au pire « Il s'est échappé, il reviendra »). Cueillette : quelques baies, champignons, fleurs sauvages apparaissent à l'aube sur les terrains de forêt non achetés.
- **Pourquoi** : rituel calme, utile pour les commandes et l'album, occupe les jours d'hiver.
- **Chez nous** : la Carrière mentionne la pêche et la mare ; la cueillette sur les terrains de forêt encore à vendre leur donne une utilité avant l'achat.
- **Effort** : M. **Risque** : faible ; vibration désactivable.

**B8. Lettres du matin et petit journal** — *Stardew (courrier), Hay Day (journal), Fields of Mistria (écran du matin)*
- **Quoi** : une boîte aux lettres dans la scène : lettres de Joseph, de la boulangère, de la mairie, recettes, conseils, cadeaux (« Merci pour les confitures, voici des graines »). Un petit « Journal du village » à chaque saison (météo prévue, fête à venir, potins, cours du marché).
- **Pourquoi** : récit ambiant à faible coût, informe sans tutoriel, chaleur humaine.
- **Effort** : S à M (surtout de l'écriture). **Risque** : trop de texte ; 2 lignes par lettre, lecture facultative.

**B9. Voisins du village (petit cercle de 4 ou 5 personnages)** — *tous les titres ; Project Horseshoe : ensemble restreint, un grincheux*
- **Quoi** : en plus de Joseph : la boulangère, le facteur, une enfant curieuse, une vieille dame grincheuse qui s'adoucit, un apiculteur. Chacun a des goûts (le carnet les mémorise, comme Mistria), une demande de temps en temps, et 3 petites scènes d'amitié.
- **Effort** : L (écriture, portraits, logique). **Risque** : dilution ; commencer par 2 personnages.

### 5.C Accessibilité et prise en main

**C1. Vitesse « Douce » (×0,5) et temps qui s'arrête pendant les décisions** — *Fields of Mistria (vitesse de la journée), Littlewood (le temps ne passe que quand on agit), retours de nos joueurs*
- **Quoi** : ajouter une vitesse ×0,5 (journée de 40 s) ; **pause automatique** quand une feuille de décision est ouverte (choix des graines, achat, carnet) — option activée par défaut en Détente.
- **Pourquoi** : supprime la cause n° 1 du stress (« j'ai oublié d'appuyer sur pause, c'était déjà trop tard »).
- **Effort** : S. **Risque** : aucun (option).

**C2. Pause intelligente sur les moments clés** — *bonnes pratiques Can I Play That, Project Horseshoe (interruptions)*
- **Quoi** : le jeu se met en pause (ou ralentit) automatiquement : 2 jours avant un fermage si l'argent manque, à l'arrivée du gel, quand un événement demande une réponse. En option.
- **Effort** : S. **Risque** : interrompre trop ; une seule pause par événement.

**C3. Guide de la ferme relisable** — *critique de Fields of Mistria (tutoriels non relisables)*
- **Quoi** : dans Menu → « Guide » : toutes les bulles de conseil déjà vues, rangées par thème, avec une petite image ; bouton « Revoir ce conseil ».
- **Effort** : S (les textes existent dans `hints.js`). **Risque** : aucun.

**C4. Écran du matin / résumé du jour** — *Fields of Mistria (rappels du matin), Stardew (message du matin)*
- **Quoi** : bandeau léger à l'aube (non bloquant) : météo, ce qui est mûr, commandes, fête dans 2 jours, anniversaire d'un voisin. Toucher → ouvrir le détail.
- **Effort** : S. **Risque** : surcharge ; 2 lignes max.

**C5. Indicateurs « que faire maintenant ? »** — *Hay Day (concepts logiques), Animal Crossing (Critterpedia « disponible maintenant »)*
- **Quoi** : petite icône pulsante sur ce qui attend le joueur (parcelle mûre, bâtiment plein, commande livrable) ; bouton « Récolter tout ce qui est mûr » (un toucher). Dans la feuille des graines : badge « Conseillé » sur 1 ou 2 cultures adaptées (temps restant avant gel, commande en cours).
- **Effort** : S à M. **Risque** : assistanat ; désactivable.

**C6. Pas d'échec dur, seulement des issues douces** — *Unpacking, Farm Together, Stardew (évanouissement doux), Project Horseshoe*
- **Quoi** : généraliser : en Détente, la « faillite » devient une **saison difficile** racontée (Joseph aide, on perd une étoile possible mais on continue). En Classique, garder la faillite mais avec « Reprendre au début de la saison ».
- **Effort** : S à M (une partie existe déjà). **Risque** : moins d'enjeu ; d'où le maintien du mode Classique et des étoiles.

**C7. Options de confort sensoriel** — *Fields of Mistria, Can I Play That*
- **Quoi** : taille du texte (×1 / ×1,25 / ×1,5), contraste renforcé des surbrillances, couper les particules météo, couper les sons d'animaux séparément, mode daltonien pour les états des parcelles (icône en plus de la couleur).
- **Effort** : S à M. **Risque** : mise en page portrait à vérifier (360 px).

**C8. Commandes d'une main confirmées** — *Stardew mobile (tap-to-move critiqué), Harvest Moon HSH (toucher-glisser apprécié)*
- **Quoi** : vérifier que toutes les actions principales sont dans le tiers bas de l'écran (pouce), glisser pour arroser/récolter (déjà là), vibration courte à la récolte d'or (désactivable).
- **Effort** : S. **Risque** : aucun.

### 5.D Motivation à long terme

**D1. Évaluation de fin d'année façon « grand-père »** — *Stardew (bougies de l'autel, seconde chance avec un diamant)*
- **Quoi** : chaque hiver (Carrière) ou fin de niveau, Joseph (ou le souvenir du grand-père, archétype « retour au pays ») passe juger l'année sur 5 critères visibles (argent, diversité des récoltes, bien-être des animaux, village aidé, album) et allume **1 à 4 lanternes** sur le perron. 4 lanternes = décoration permanente unique. On peut toujours faire mieux l'année suivante.
- **Pourquoi** : bilan **narratif et chaleureux** plutôt qu'un tableau de chiffres ; récompense la diversité, pas seulement l'argent.
- **Effort** : M. **Risque** : doublon avec les étoiles ; en Carrière, il n'y a pas d'étoiles, c'est donc complémentaire.

**D2. Réputation du village à paliers avec petits cadeaux** — *Fields of Mistria (100 niveaux de renommée, coffre de récompenses), Coral Island (rang F → S qui débloque cultures et bêtes)*
- **Quoi** : chaque vente, commande, don au village fait monter une barre de réputation ; **chaque palier** donne un petit cadeau à aller chercher dans un panier près de la maison (graines rares, décoration, recette). Les paliers nommés débloquent des cultures.
- **Chez nous** : les rangs de Carrière jouent ce rôle mais sont espacés ; la réputation remplirait les « creux » entre deux rangs avec des récompenses fréquentes.
- **Effort** : M. **Risque** : doublon avec rangs/succès ; fusionner avec B2 si possible.

**D3. Saisons qui changent d'une année à l'autre** — *Coral Island (« une raison d'attendre l'année suivante »), Animal Crossing (fêtes, créatures saisonnières)*
- **Quoi** : en Carrière, chaque année a un **thème** tiré au sort (année des abeilles, année des pommes, année pluvieuse, année du grand comice) avec 1 culture vedette (cours ×1,3), une fête spéciale, un visiteur unique. Les années deviennent mémorables et différentes.
- **Pourquoi** : réutilise l'idée des 12 niveaux (« une année = une contrainte ») dans la Carrière, contre la routine de l'année 3+.
- **Effort** : M. **Risque** : équilibrage ; thèmes uniquement positifs.

**D4. Objectifs « pour la beauté »** — *Animal Crossing (étoiles de l'île), Project Horseshoe (expression)*
- **Quoi** : une note « Charme de la ferme » qui monte avec la décoration, les allées, les fleurs, la variété des animaux ; paliers qui font venir des touristes et des animaux sauvages (papillons, hérisson, cigogne sur le toit).
- **Pourquoi** : donne un usage tardif aux écus et à l'argent, satisfait les joueurs « décorateurs ».
- **Effort** : M. **Risque** : faible.

**D5. Défis de saison et ferme de la semaine (hors ligne)** — *Hay Day (événements), Animal Crossing*
- **Quoi** : un « défi de la semaine » calculé à partir de la date (sans serveur) : graine du jour pour tout le monde, mêmes conditions, record local à battre. Partage d'une image de la ferme.
- **Effort** : M. **Risque** : FOMO si trop mis en avant ; garder hors du chemin principal.

**D6. Héritage entre parties** — *déjà les bonus permanents ; Stardew (statue)*
- **Quoi** : les plus beaux objets gagnés (coupe du comice, lanternes, culture géante empaillée) s'exposent dans la Grange aux souvenirs comme une vitrine qui se remplit.
- **Effort** : S à M. **Risque** : aucun.

### 5.E Jus et retours (juiciness)

**E1. Récolte qui « pop »** — *Juice it or lose it, Hay Day, Stardew*
- **Quoi** : la plante saute (écrasement-étirement), quelques feuilles volent, la pièce décrit une courbe vers le compteur d'argent qui grossit un instant ; **son qui monte d'un demi-ton** à chaque récolte d'une série rapide (glisser), retombe ensuite.
- **Effort** : S. **Risque** : surcharge visuelle ; respecter « animations réduites ».

**E2. Bruitages par matière** — *Unpacking (14 000 bruitages)*
- **Quoi** : sons différents selon ce qu'on touche : terre, eau, foin, bois, œuf, pot de confiture ; à partir de banques CC0 (Kenney, freesound CC0, déjà nos sources).
- **Effort** : S à M. **Risque** : licences (vérifier CREDITS.md).

**E3. Le monde qui réagit** — *Cozy Grove (la couleur revient), Project Horseshoe (animaux détendus)*
- **Quoi** : animaux qui sautillent quand on les touche, poules qui suivent le fermier, chat qui dort au soleil sur le perron, oiseaux qui s'envolent quand on passe, fumée de la cheminée plus épaisse en hiver, fleurs qui poussent toutes seules autour des ruches.
- **Effort** : M (rendu). **Risque** : performances sur téléphone ; limiter le nombre d'éléments.

**E4. Fin de saison célébrée** — *Stardew (écran d'expédition), Animal Crossing*
- **Quoi** : le résumé de saison devient une petite scène : les récoltes défilent dans une charrette, chiffres qui s'additionnent avec un son de caisse, une phrase de Joseph adaptée à la saison.
- **Effort** : S à M. **Risque** : allonger ; bouton « Passer ».

**E5. Vibrations courtes et douces** — *HM Home Sweet Home critiqué pour l'absence d'haptique*
- **Quoi** : 10 ms à la récolte, 20 ms à la récolte d'or, motif doux au passage de rang (option déjà présente : vérifier la couverture).
- **Effort** : S. **Risque** : aucun.

**E6. Photo de la ferme** — *Animal Crossing (photos), Project Horseshoe (partage consenti)*
- **Quoi** : bouton « Photo » : capture du canvas avec un cadre saisonnier et le nom de la ferme, partage via le menu de partage du téléphone (API Web Share).
- **Effort** : S à M. **Risque** : aucun ; rien n'est envoyé sans action du joueur.

---

## 6. Les 15 mécaniques les plus prometteuses (et ordre de réalisation conseillé)

Critères : rapport plaisir / effort, adéquation téléphone portrait une main, réponse directe aux trois objectifs (accessible, amusant, moins répétitif), compatibilité avec ce qui existe.

| # | Mécanique | Objectif principal | Effort | Pourquoi en priorité |
|---|---|---|---|---|
| 1 | **C1 Vitesse ×0,5 + pause pendant les décisions** | Accessibilité | S | Corrige le stress déjà signalé par nos joueurs. |
| 2 | **A1 Tableau des commandes (3 places)** | Moins de répétition | M | La mécanique de variété n° 1 du genre sur téléphone (Hay Day, Stardew, Pocket Camp). |
| 3 | **A2 Belles récoltes et récoltes d'or** | Fun / surprise | S–M | Récompense variable sur le geste le plus fréquent. |
| 4 | **B1 Album de la ferme (collection)** | Long terme | M | Réutilise tout le contenu existant ; plaisir de compléter sans pression. |
| 5 | **E1 Récolte qui pop + son qui monte en série** | Jus | S | Rend le geste principal savoureux. |
| 6 | **B4 Surprises nocturnes rares et positives** | Surprise | S–M | « Tout peut arriver » sans danger. |
| 7 | **A6 Météos et jours spéciaux rares** | Moins de répétition | S–M | Réutilise la météo et les particules. |
| 8 | **B2 Restauration du village (paniers)** | Long terme | L | Le grand but qui manque à la Carrière tardive (cf. lassitude « an 3 » de Stardew). |
| 9 | **B3 Fêtes avec mini-jeu d'un pouce** | Fun / rituel | M–L | Rituels saisonniers, rupture de rythme ; les fêtes existent déjà. |
| 10 | **A4 Visiteurs et marchand ambulant à date fixe** | Moins de répétition | M | Crée l'attente (« c'est le jour du marchand »). |
| 11 | **C3 Guide relisable + C4 résumé du matin** | Accessibilité | S | Textes déjà écrits ; critique explicite faite à Mistria. |
| 12 | **D1 Évaluation de fin d'année (lanternes)** | Long terme | M | Bilan chaleureux qui récompense la diversité. |
| 13 | **D3 Années à thème en Carrière** | Moins de répétition | M | Porte l'idée « une année = une contrainte » dans la Carrière. |
| 14 | **B6 Cuisine / recettes** | Fun / expérimentation | M | Découverte de combinaisons, cadeaux, album. |
| 15 | **A5 Cultures géantes** | Surprise | M | Image mémorable, envie de photographier. |

**Ordre conseillé** (lots cohérents, du moins risqué au plus ambitieux) :
1. **Lot confort** (S) : C1, C2, C3, C4, E1, E5 — gain d'accessibilité et de plaisir immédiat, sans toucher à l'équilibre.
2. **Lot surprise** (M) : A2, A6, B4, A5 — tout passe par l'aube et la récolte ; simulation à relancer pour l'équilibre de A2.
3. **Lot collection et demandes** (M) : B1, A1, A3, B8 — l'album sert de colonne vertébrale (chaque commande, surprise, recette y entre).
4. **Lot rituels** (M–L) : B3, A4, B6, D1.
5. **Lot village** (L) : B2, B9, D2, D3 — le grand chantier de la Carrière.

**À éviter** (leçons des autres jeux) : énergie / endurance ; minuteurs en temps réel et limites quotidiennes strictes (Cozy Grove divise) ; corvée longue avant le contenu (Coral Island) ; multiplier fermes et monnaies (Sun Haven) ; fabrication un par un (Olive Town, AC:NH) ; boucles d'interdépendance au départ (Ooblets) ; notifications insistantes et FOMO (Project Horseshoe).

---

## 7. Toutes les sources

Littérature et conférences :
- Project Horseshoe 2017, « Coziness in Games » : https://www.projecthorseshoe.com/reports/featured/ph17r3.htm
- Présentation du rapport : https://pixelpoppers.com/link/d64e95/group-report-coziness-in-games-an-exploration-of-safety-softness-and-satisfied-needs/
- Vice sur les cosy games : https://www.vice.com/en/article/cozy-games-yoshi-animal-crossing
- Daniel Cook, « What is a Daniel Cook game? » : https://lostgarden.com/2023/07/08/what-is-a-daniel-cook-game/
- Unpacking, piliers de conception : https://www.gamedeveloper.com/design/unpacking-the-design-pillars-of-a-chill-puzzle-game
- GDC Vault, « Unpacking Zen » : https://www.gdcvault.com/play/1029400/-Unpacking-Zen-Designing-a
- Audiokinetic, bruitages d'Unpacking : https://blog.audiokinetic.com/en/unpacking-the-fun-behind-the-foley/
- GDC 2022, session audio Unpacking : https://gdconf.com/news/discover-fun-behind-foley-unpacking-gdc-2022-session
- « Juice it or lose it » : https://roblog.co.uk/2024/03/juicy-games/

Stardew Valley :
- https://www.stardewvalley.net/?p=875
- https://strategywiki.org/wiki/Stardew_Valley/Community_Centre
- https://wiki.stardewvalley.net/Crops
- https://stardewvalleywiki.com/Festival
- https://stardewvalleywiki.com/Grange_Display
- https://stardewvalleywiki.com/Random_Events
- https://stardewvalleywiki.com/Help_Wanted
- https://www.stardewvalleywiki.com/Special_Orders
- https://stardewvalleywiki.com/Grandpa%27s_Evaluation
- https://stardewvalleywiki.com/Mobile_Controls
- https://www.pocketgamer.com/articles/079085/stardew-valley-review/
- https://forums.stardewvalley.net/posts/221293/
- https://steamcommunity.com/app/413150/discussions/0/357284131788423175
- https://forums.stardewvalley.net/threads/having-a-problem-with-motivation-need-help.2715/latest
- https://strategywiki.org/wiki/Stardew_Valley/Later_Years
- https://www.npr.org/2025/01/24/g-s1-44510/the-legacy-and-future-of-the-farming-game-stardew-valley

Story of Seasons / Harvest Moon :
- https://rpgsite.net/review/11080-story-of-seasons-pioneers-of-olive-town-review
- https://nintendolife.com/reviews/nintendo-switch/story_of_seasons_pioneers_of_olive_town
- https://toucharcade.com/?p=328143
- https://finalweapon.net/2024/12/23/harvest-moon-home-sweet-home-review-android/

Animal Crossing (New Horizons, Pocket Camp) :
- https://pixelpoppers.com/2020/03/nook-miles-and-binge-playing/
- https://www.thegamer.com/animal-crossing-new-horizons-complete-guide-nook-miles/
- https://www.tuni.fi/playlab/?p=10347
- https://www.fandom.com/articles/time-traveling-animal-crossing
- https://kotaku.com/i-love-animal-crossing-new-horizons-museum-1842798339
- https://nookipedia.com/wiki/Museum
- https://www.techradar.com/news/animal-crossing-pocket-camp-everything-you-need-to-know-about-the-mobile-game
- https://www.pocketgamer.com/animal-crossing-pocket-camp/animal-crossing-pocket-camp-tips-and-tricks-maxing-friendship-levels-filling-you/
- https://destructoid.com/?p=208519

Fields of Mistria :
- https://caniplaythat.com/?p=18295
- https://destructoid.com/?p=572633
- https://deltiasgaming.com/?p=173455
- https://gamingtrend.com/impressions/fields-of-mistria-early-access-impressions-sailor-moon-goes-farming

Autres jeux :
- Farm Together : https://www.gameinformer.com/review/farm-together/stress-free-crop-growing-fun · https://www.xboxtavern.com/farm-together-review/
- Cozy Grove : https://broadly.vice.com/en/article/bvx9vw/cozy-grove-is-ok-telling-players-to-log-off-its-delightful · https://siliconera.com/?p=876221 · https://gamecritics.com/cody-bolster/cozy-grove-review/ · https://www.pockettactics.com/cozy-grove/review
- Wylde Flowers : https://www.pockettactics.com/wylde-flowers/review · https://cozygamereviews.com/wylde-flowers-review/ · https://www.pockettactics.com/wylde-flowers/app-store-awards
- Sun Haven : https://metaphorsandmoonlight.com/game-review-sun-haven-by-pixel-sprout-studios/ · https://gameluster.com/review-sun-haven-a-star-within-its-field/
- Coral Island : https://checkpointgaming.net/reviews/2023/11/coral-island-review-coasting-by/ · https://cozygamereviews.com/coral-island-review/ · https://commonsensegamer.com/coral-island-how-to-increase-town-rank-fast/
- Littlewood : https://nintendowire.com/reviews/littlewood/ · https://gameluster.com/review-littlewood-the-peaceful-rpg/ · https://kotaku.com/littlewood-is-a-game-about-rebuilding-your-town-after-y-1834517443
- Ooblets : https://gameinformer.com/review/ooblets/a-cheerful-grind · https://nintendoworldreport.com/review/61370
- Hay Day : https://www.deconstructoroffun.com/blog//2013/01/behind-success-of-hay-day.html · https://gamedeveloper.com/business/game-monetization-design-analysis-of-hay-day
- Rusty's Retirement : https://en.wikipedia.org/wiki/Rusty%27s_Retirement · https://aiptcomics.com/2024/05/13/rustys-retirement-idle-game-review
