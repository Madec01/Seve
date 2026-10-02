# Recherche : mécaniques des jeux de ferme et de gestion « cosy » sur téléphone

*Pour « Une année à la ferme » : plus accessible, plus amusant, moins répétitif. Recherche du 2026-10-02.*

---

## 0. Méthode et cadrage

**Sources** : articles d'analyse (Deconstructor of Fun, Naavik, Game Developer / Gamasutra, mobilegamer.biz, PocketGamer.biz), entretiens de développeurs (Supercell pour Hay Day, Spry Fox pour Cozy Grove, Toukana pour Dorfromantik, Dinosaur Polo Club pour Mini Metro, Kongregate pour AdVenture Capitalist), wikis de joueurs (Stardew, Egg Inc., Hay Day, Township), tests (TouchArcade, Pocket Gamer, Gamezebo), et référentiels (Game Accessibility Guidelines, Smashing Magazine). Les wikis Fandom (Hay Day) refusaient la lecture directe (HTTP 402) : leur contenu a été recoupé par les moteurs de recherche et des guides tiers. La liste des URL est à la fin.

**Ce qui distingue notre jeu de ses modèles** (ça compte pour juger ce qui se transpose) :

| Notre jeu | Hay Day, Township, Travel Town, Egg Inc. |
|---|---|
| Temps **accéléré** (1 jour = 20 s, une année ≈ 10-12 min en mode Niveaux), pause et vitesses ×1/×2/×4 | Minuteurs en **temps réel** (minutes, heures, jours) |
| **Aucune monétisation** | Les minuteurs, l'énergie et la place au stockage existent surtout pour vendre des accélérations |
| **Pas de progression hors ligne** (décision du propriétaire) | La progression hors ligne est au cœur de la boucle (« revenir récolter ») |
| Jeu solo, hors ligne (PWA) | Social (quartiers, échanges, classements) |
| Arbitrage de survie (fermage, hiver) | Pas d'échec possible (« il n'arrive jamais rien de grave ») |

**Conséquence générale** : on peut garder les *formes* qui rendent ces jeux agréables (tableau de commandes, bateau à remplir, collections, gestes de récolte au doigt, rythme de petits objectifs, juiciness) et jeter les *frictions* qui n'existent que pour vendre (énergie, stockage étroit, attente longue, pression des séries de connexion). Chez nous, l'« attente » se mesure en **jours de jeu** (20 s) : elle n'est jamais longue en vrai, ce qui est un énorme avantage — le joueur peut toujours accélérer gratuitement.

**Ce que le jeu a déjà** (d'après `docs/GAME_DESIGN.md` et `docs/CARRIERE.md`) et qu'on ne reproposera pas tel quel : glisser pour arroser/récolter en série, « semer partout », feuilles du bas, 26 succès avec barres de progression, écus et décorations, visiteurs acheteurs, quêtes de Joseph sans compte à rebours, fêtes au calendrier, comice agricole, événements au hasard non destructeurs, rangs de la ferme, machines et employés, mode Détente, conseils la première fois. Le catalogue ci-dessous s'appuie sur ces bases et propose ce qui **manque** ou ce qui **améliorerait** l'existant.

---

## 1. Ce que chaque jeu apprend (fiches courtes)

### Hay Day (Supercell, 2012) — la référence du genre
- **Gestes au doigt** : on touche un outil (faux, sac de graines) puis on **glisse** sur tous les champs ; c'est le moment où l'équipe a su que la ferme marcherait sur tablette (« touch controls for simple actions like weeding or sowing crops »). Nous l'avons déjà (glisser pour arroser/récolter) — à étendre aux animaux et ateliers.
- **Pas de tutoriel imposé, une économie logique** : « we don't teach our players to play Hay Day » ; poule → œuf → gaufre, tout se comprend tout seul. Les concepts sont « very logical and thus easy to understand ».
- **« Nothing bad ever really happens »** : les cultures ne meurent jamais ; le ton années 50 et l'humour (le « sauna à cochons ») remplacent toute punition.
- **Plusieurs débouchés pour un même produit**, chacun avec son rythme :
  - **Tableau de commandes du camion** (9 commandes environ) : demandes courtes de 1 à 3 produits, payées en pièces + XP ; on peut **jeter** une commande qui ne plaît pas (une nouvelle arrive après un délai).
  - **Le bateau** (à partir du niveau 19) : reste **16 h** à quai, demande des **caisses** aléatoires ; tout remplir avant le départ donne un bonus ; les voisins peuvent aider.
  - **L'étal au bord de la route** : on fixe soi-même le prix, les clients (et les autres joueurs via le **journal**) achètent.
  - **Les visiteurs** qui passent sur la ferme et demandent un ou deux produits.
- **Le Derby** (2015, hebdomadaire, en quartier) : chaque joueur choisit des **tâches** sur un tableau (par ex. « produire 10 pains »), gagne des points ; c'est ce qui « changed the game completely » et a **réduit la pression sur la production de contenu** (la variété vient des combinaisons de tâches, pas de nouveaux contenus).
- **Activités secondaires** débloquées tard : pêche (niveau 27), mine, ville, vallée : elles cassent la routine sans remplacer la boucle principale.
- **Leçon de l'équipe** : polir les systèmes existants plutôt qu'en empiler de nouveaux ; ne jamais réagir dans la précipitation à un déséquilibre.

### Township (Playrix)
- Ferme + ville + mini-jeux. **Trois débouchés à rythmes différents** : hélicoptère (commandes courtes des habitants), **train** (wagons à remplir, part quand c'est plein, revient avec des matériaux d'agrandissement), avion/port (grosses commandes à caisses).
- Le train ramène **des matériaux de construction** et non de l'argent : les commandes servent d'**autre monnaie** pour l'agrandissement → les commandes ne sont pas « juste de l'argent en plus ».
- **Zoo** (cartes d'animaux à collectionner, enclos), **collections d'objets rares** trouvés en récoltant/produisant, **régate** (compétition de coopérative sur 4 semaines). Township a été l'un des premiers à tester **des mini-jeux dans les événements** pour varier.

### FarmVille 3 (Zynga)
- **Les animaux au centre** : élevage et **croisements** pour découvrir de nouvelles races (150+), chacune donnant un produit. Bébés à faire grandir.
- **Ouvriers spécialisés** (bûcheron, cuisinier) qui montent de niveau et débloquent des recettes.
- **Choisir quel habitat rénover et où s'agrandir** : la carte de la ferme est un choix, pas un couloir.

### Family Island / Klondike Adventures (jeux d'exploration-ferme)
- La ferme est une **base**, et le plaisir vient des **expéditions** sur des îles/zones à défricher (obstacles à dégager, trésors, histoire), avec un panneau d'objectifs à gauche et des puzzles « objets à trouver ».
- Leur moteur est l'**énergie** (à éviter chez nous). À garder : **défricher un terrain révèle des surprises** (coffres, objets de collection, un animal perdu) et une **petite histoire** par zone.

### Jeux de fusion (Merge Mansion, Merge Gardens, Travel Town, Gossip Harbor)
- Plateau à cases fixes, **générateurs** qui crachent des objets de niveau 1, fusion deux par deux, **commandes affichées en haut** qui demandent des objets précis ; chaque commande remplie fait avancer la rénovation et l'**histoire**.
- **Merge Mansion** : plateau de taille fixe qui empêche l'accumulation, fusions deux à deux « moins écrasantes » que Merge Dragons ; sessions plus courtes (≈ 33 min/jour contre 70 pour la moyenne du genre) ; **l'histoire est le moteur** principal.
- **Merge Gardens** (redémarrage 2023) : remplacer des personnages utilitaires par une **histoire** (« vous ne nettoyez pas le jardin, vous sauvez des gens d'une malédiction ») a relancé le jeu.
- À garder : **la commande visible en permanence** (on sait toujours quoi faire), **l'histoire découpée en petites étapes**, la satisfaction de la fusion (deux objets → un mieux). À éviter : l'énergie, le stockage comme friction.

### Stardew Valley (mobile)
- Plusieurs schémas de contrôle (toucher pour se déplacer + attaque auto, joystick) ; la frontière floue entre « toucher pour agir » et « toucher pour aller » rend certains gestes **ambigus** — exactement le problème « un geste = une intention » de notre `MOBILE.md`.
- **Le Centre communautaire (« bundles »)** : des **paniers thématiques** (un par aspect du jeu : potager de printemps, pêche, artisanat…) ; chaque salle complétée **change le monde pour toujours** (un pont réparé, une zone ouverte). Conçu pour n'être **pas grindy** mais pour **faire explorer** toutes les facettes du jeu.
- **Collections** : onglet « expéditions » (chaque objet vendu au moins une fois coche une case), musée, recettes, poissons. Récompenses : des choses visibles (statue, lettre de grand-père).

### Animal Crossing : Pocket Camp
- Sessions courtes : des **habitants** au camp avec une **bulle de demande** (un fruit, un poisson) ; livrer augmente l'**amitié**, qui débloque dialogues, meubles et invitations.
- Les demandes durent quelques heures : on **tourne** entre plusieurs petits personnages, chacun avec sa personnalité → la variété vient des **personnages**, pas des règles.

### Neko Atsume / Cozy Grove (attente douce)
- **Neko Atsume** : on pose de la nourriture et des jouets, on revient voir qui est passé ; l'**album** des chats (silhouettes grises jusqu'à la rencontre) est toute la motivation à long terme. Aucune punition.
- **Cozy Grove** : rythme volontairement limité ; après ~20 minutes le jeu dit **« c'est bien, tu peux revenir demain »** — conçu comme une série télé en épisodes plutôt que comme une boucle infinie (David Edery, Spry Fox). Chez nous : **la fin de saison et la fin d'année** sont des points d'arrêt naturels à soigner.

### Jeux idle / incrémentaux (Egg, Inc., AdVenture Capitalist, Idle Farm Tycoon)
- **Générateurs** et coûts exponentiels, **managers** qui automatisent un poste (comme nos employés), **paliers** de quantité qui doublent un revenu (« 25 poules : production ×2 »).
- **Prestige** : on recommence avec un bonus permanent (« âmes d'œufs » dans Egg Inc.) ; sert à créer une « échelle » de puissance et à **ré-encadrer** une croissance devenue absurde. Selon Anthony Pecorella (Kongregate), il faut une progression **« bosselée »** (des seuils qui déclenchent des multiplicateurs, pas une pente lisse) ; et le prestige n'est pas obligatoire : on peut aussi motiver par **le dévoilement de nouveaux systèmes** ou **les collections**.
- **Contrats d'Egg Inc.** : missions à durée limitée (« livrer N œufs de tel type ») avec 1 à 3 paliers de récompense → un **objectif à paliers** est plus doux qu'un tout-ou-rien.

### Petits jeux de construction relaxants (Mini Metro, Islanders, Townscaper, Dorfromantik)
- **Mini Metro** : chaque **semaine de jeu**, **un choix entre deux améliorations** (nouvelle ligne, tunnel, wagon…). Interface « belle par élimination » (GDC 2017, *When Less Is More*).
- **Islanders** : choisir **un paquet parmi deux** ; marquer assez de points pour débloquer le paquet suivant ; tout est **transparent** (on voit les points avant de poser).
- **Townscaper** : un **jouet**, sans objectif ; le plaisir vient de la réponse visuelle immédiate et procédurale à chaque toucher.
- **Dorfromantik** : la règle d'or de l'équipe : **« l'interaction que le joueur fait le plus doit être la plus satisfaisante possible »** (petites animations, sons). Les **quêtes** sont posées sur le plateau (« forêt de 30 arbres », « 5 tuiles de rivière ») et **rallongent la partie** en donnant de nouvelles tuiles ; les **succès débloquent de nouvelles tuiles et des biomes** ; mode créatif sans pression ; difficulté « pas trop punitive pour qui construit pour le plaisir des yeux ».

### Two Point Hospital (gestion légère)
- Chaque hôpital (= niveau) **met l'accent sur une seule mécanique** (le froid → le chauffage, la salle de formation…) ; 1 étoile pour passer, 2 et 3 pour qui veut aller plus loin ; **maladies absurdes** pour l'humour ; monnaie d'objectifs (Kudosh) dépensée en objets décoratifs. C'est exactement la structure de notre mode Niveaux ; l'humour et les « twists » sont à pousser.

### Kingdom Two Crowns (interface minimale)
- Presque pas d'interface ; l'argent est **dans le monde** (une bourse, des pièces qu'on lâche). À retenir : **montrer l'information dans la scène** (une caisse qui se remplit, un panier qui déborde) plutôt que par des chiffres.

### Plant Tycoon
- **Croisements de plantes** (500+ espèces) pour trouver 6 plantes magiques ; collection d'insectes ; « temps réel : de nouvelles surprises à chaque ouverture ». La **découverte par croisement** est une source de surprise peu coûteuse en contenu.

---

## 2. Grands thèmes transversaux

### 2.1 UX d'une main en portrait
- **Zones du pouce** : tiers bas = actions principales ; coins hauts = informations seulement (Smashing Magazine, Parachute Design). Notre HUD en haut doit rester **lecture seule** autant que possible ; tout ce qui se touche souvent descend.
- **Un outil + un glisser** (Hay Day) : le geste en série est la vraie « action groupée ». À étendre : ramasser les œufs/le lait en glissant sur les abris, remplir les ateliers en glissant.
- **« Tout ramasser »** : bouton ou geste unique quand plusieurs choses sont prêtes (pratique universelle des jeux idle) ; chez nous, un bouton contextuel flottant « Ramasser tout (7) » au-dessus des onglets.
- **Feuilles du bas** et listes à grandes lignes (déjà fait) ; **appui long = détails** ; **un geste = une intention** (leçon de Stardew mobile).
- **Information dans la scène** (Kingdom) : bulles au-dessus des bâtiments prêts, sacs pleins, fumée d'atelier, plutôt que des listes.

### 2.2 Sessions courtes mais satisfaisantes
- Une session doit **finir sur une récompense** : fin de saison (résumé), fin d'année (bilan), commande livrée. Cozy Grove ose dire « reviens demain ».
- Notre année de 10-12 min est déjà un format idéal ; en Carrière (sans fin), il faut des **points d'arrêt** : fin de saison avec résumé, « carnet de la saison », sauvegarde visible.

### 2.3 Commandes et demandes (le moteur de variété du genre)
- **Plusieurs débouchés à rythmes différents** : commandes courtes (camion/hélicoptère), commandes longues à caisses (bateau/train), clients de passage, vente libre (étal). Chacun pose une question différente au joueur (*quoi produire ?*, *quand ?*, *garder ou vendre ?*).
- **Commandes qu'on peut refuser** sans pénalité, **visibles en permanence**, **réalisables** avec ce qu'on a ou presque (nos visiteurs le font déjà).
- **Récompenses différentes de l'argent** (Township : matériaux) pour que la commande ait un sens propre.

### 2.4 Lisibilité des chaînes de production
- Hay Day réussit parce que chaque étape est **logique** (lait → fromage) et **visible** (l'atelier montre ce qu'il fait, la file d'attente se voit).
- Recommandations : icône « ingrédients → produit » sur chaque recette, **ce qui manque en rouge avec son origine** (« lait : étable »), file d'attente visible sur le bâtiment, flèche ou ligne pointillée vers la source quand on touche un ingrédient manquant.

### 2.5 Attentes et minuteurs non stressants (sans monétisation)
- Chez les concurrents, l'attente est une friction vendue. Chez nous, elle est **toujours courte** (jours de 20 s) et le joueur maîtrise la vitesse : c'est déjà non stressant.
- Bonnes pratiques à garder : **rien ne pourrit** (Hay Day ; chez nous : produits des animaux plafonnés à 3 jours sans perte, déjà prévu), **pas de compte à rebours qui démarre sans accord** (déjà fait pour Joseph), **rappels doux** la veille.
- **Remplir l'attente avec des choix** plutôt qu'avec du vide : décorer, planifier, lire le carnet, petites activités (pêche, cueillette).

### 2.6 Progression hors ligne : le propriétaire a dit non — alternatives
1. **Bonus de repos « positif »** (World of Warcraft, *rested XP*) : au retour après une absence, la première saison donne un petit bonus (« Joseph a gardé la ferme : +10 % de pousse pendant 3 jours »), présenté comme un cadeau, jamais comme une compensation. Ce n'est pas de la progression hors ligne (la ferme n'a pas tourné), juste un accueil.
2. **Courrier du retour** : une lettre de Joseph ou d'un habitant qui rappelle où on en était (« Tu avais promis 6 fromages à Mme Leblanc »), un **résumé de reprise** (« Où en étais-je ? »).
3. **Accélération ×8 en hiver ou en attente** : permettre d'aller plus vite quand il n'y a rien à faire (temps compressé à la demande = l'inverse du minuteur).
4. **« Passer à demain »** quand tout est fait (bouton qui saute à l'aube suivante, comme dormir dans Stardew).

### 2.7 Collections et albums
- Album à silhouettes grises (Neko Atsume), onglet d'expéditions (Stardew), cartes du zoo (Township), objets rares trouvés en récoltant (Township). C'est la motivation à long terme la moins stressante qui existe : **on progresse en jouant normalement**.

### 2.8 Rythme des objectifs
- **Toujours un objectif proche, un moyen, un lointain** : commande en cours (minutes), objectif de saison / quête de Joseph (une saison), rang / collection (années).
- Paliers « bosselés » (Pecorella) : des seuils qui déclenchent un saut visible (« 10 poules : la poule dorée arrive »).

### 2.9 Objectifs quotidiens / hebdomadaires légers
- Dans un jeu hors ligne à temps accéléré, « quotidien » ne veut rien dire en temps réel. **Les transposer en temps de jeu** : 3 petits défis **par saison** (le « Derby » de Hay Day en solo), au choix, remplaçables une fois, sans série à perdre.
- Si on veut un lien avec le calendrier réel : **jamais de série punitive** ; au plus un petit cadeau la première partie du jour, cumulable, avec « gel » automatique (Smashing Magazine 2026 : les séries punitives transforment le plaisir en obligation).

### 2.10 Événements
- Hay Day/Township : événements thématiques, mini-jeux, tâches temporaires. Chez nous, fêtes et comice existent : leur ajouter **une petite activité propre** (mini-jeu ou commande spéciale) et un **objet de collection** par fête.

### 2.11 Décorations
- Chez Hay Day et Pocket Camp, la décoration est une **expression** (photos, visites) ; Two Point la relie à des **effets légers** (attrait). Chez nous : décor partagé, écus. Idée : **attrait** de la ferme qui fait venir plus de touristes/visiteurs (déjà esquissé en Carrière), **ensembles** de décorations (3 pièces d'un même thème = petit bonus ou animation).

### 2.12 Prestige / renaissance
- Le prestige d'Egg Inc. est un « Nouvelle partie + » avec multiplicateur. Notre mode Niveaux (années successives + étoiles permanentes) est déjà un prestige déguisé. En Carrière, le prestige classique (tout perdre) contredit l'esprit cosy ; alternative : **« transmettre la ferme »** (héritage) après le Domaine, avec une nouvelle région/climat et des souvenirs conservés (voir catalogue).

### 2.13 Prise en main (FTUE)
- Faire jouer **dans la première minute**, apprendre **en jouant**, montrer vite ce qui est unique, un « moment aha » (Liquid & Grit, PocketGamer.biz) ; 80-90 % des jeux sont abandonnés après la première utilisation à cause d'une mauvaise prise en main (AdInMo).
- Hay Day : **pas de tutoriel**, une économie logique. Two Point : **un niveau = une mécanique**. Dorfromantik : on commence avec une seule règle.
- **Déblocage progressif** : chaque bouton apparaît au moment où il sert (pas d'onglets vides au début), avec un petit éclat « Nouveau ! ».

### 2.14 Juiciness (retour sensoriel)
- *Juice it or lose it* (Jonasson & Purho) : interpolations (easing), écrasement-étirement, particules, couleur, son, petites expressions. Dorfromantik : soigner l'action la plus fréquente.
- Pour nous : **pièces qui volent vers le compteur** (et le compteur qui « pulse »), **son de récolte qui monte d'une note** à chaque parcelle d'un même glisser (combo musical), petit **rebond** des cultures mûres, **confettis** discrets pour un rang, vibration courte réglable.

### 2.15 Accessibilité
- Game Accessibility Guidelines (niveau de base) : vitesse de jeu réglable (on l'a), vibrations désactivables (on l'a), grandes cibles bien espacées (on l'a), **ne jamais passer une information par la couleur seule**, contraste élevé, texte lisible et **taille réglable**, langage simple, tutoriels interactifs, démarrage rapide, réglages sauvegardés, plusieurs difficultés (on l'a : Détente/Classique), volumes séparés, aucune information **seulement sonore**.

---

## 3. CATALOGUE des mécaniques transposables

Légende — **Effort** : S (quelques heures à un jour), M (quelques jours), L (une à plusieurs semaines). **Risque** : ce qui pourrait mal tourner.

### A. Moins de répétition (varier ce qu'on fait d'une saison et d'une année à l'autre)

**A1. Tableau de commandes (« le panneau du village »)**
- *Sources* : Hay Day (camion), Township (hélicoptère), Travel Town (commandes en haut), Pocket Camp (bulles).
- *Quoi* : 3 à 5 petites commandes affichées en permanence sur un panneau dans la scène (et un onglet/feuille), chacune de 1 à 3 produits, avec la récompense ; une nouvelle remplace celle qu'on a livrée ; on peut en **jeter** une (remplacée à l'aube suivante).
- *Pourquoi* : le joueur sait toujours quoi faire ; chaque commande pose une petite question différente (« cette semaine, des tomates ou du fromage ? ») ; la variété vient des combinaisons, pas de nouveau contenu.
- *Chez nous* : générées depuis ce que la ferme peut produire **cette saison** (même filtre que les visiteurs), payées un peu au-dessus du marché (×1,2 à ×1,5) + parfois un écu ou un objet de collection. En mode Niveaux, un niveau peut en faire sa contrainte. Remplace avantageusement la vente « automatique » comme seul débouché.
- *Effort* : M. *Risque* : devenir une corvée (trop de commandes, trop chères) → plafonner à 3-5, toujours facultatives, jamais de délai court.

**A2. La charrette du marché (grosse commande à caisses, hebdomadaire)**
- *Sources* : Hay Day (bateau), Township (train).
- *Quoi* : une fois par saison (ou tous les 7 jours), une charrette attend X jours et demande 6 à 9 « caisses » (ex. 3 × 4 carottes, 2 × 2 fromages…). Chaque caisse remplie paie ; **tout remplir** donne un bonus (matériau rare, écus, objet de déco).
- *Pourquoi* : objectif de moyen terme qui oblige à **diversifier** (anti-monoculture) sans forcer.
- *Chez nous* : remplace ou complète le comice pour les rangs 1-2 ; récompense « matériau » utile aux **agrandissements** (planches, tuiles) pour que ce ne soit pas que de l'argent.
- *Effort* : M. *Risque* : stress du départ → afficher clairement les jours restants, caisses partielles toujours payées, pas de pénalité.

**A3. Débouchés différenciés (chaque canal a sa personnalité)**
- *Sources* : Hay Day (camion / bateau / étal / visiteurs), Township.
- *Quoi* : l'étal (vente immédiate, prix du jour), le panneau (prix bonus, demande précise), la charrette (gros volume, bonus de complétion), le grenier (attendre le bon cours).
- *Pourquoi* : la décision « où vendre ? » renouvelle une boucle sinon identique.
- *Effort* : M (si A1 et A2 faits). *Risque* : trop de menus → un seul écran « Vendre » qui montre les 3 canaux côte à côte.

**A4. Défis de saison au choix (« Derby » en solo)**
- *Sources* : Hay Day (Derby), Egg Inc. (contrats à paliers), Islanders (choix d'un paquet parmi deux).
- *Quoi* : au début de chaque saison, 3 défis tirés au hasard (« Vendre 8 confitures », « Ne laisser aucune parcelle vide 3 jours de suite », « Ramasser 20 œufs ») ; on en garde **1 ou 2**, remplaçable une fois. Récompense à paliers (bronze/argent/or).
- *Pourquoi* : chaque saison a un petit « thème » choisi par le joueur → les années ne se ressemblent plus.
- *Effort* : M. *Risque* : liste trop « comptable » → écrire des défis variés (style, pas seulement quantité), jamais obligatoires.

**A5. Un choix entre deux améliorations en fin de saison**
- *Sources* : Mini Metro (choix hebdomadaire), Islanders, jeux « roguelite » doux.
- *Quoi* : au résumé de fin de saison, deux cartes gratuites au choix : « Engrais de printemps (+15 % de pousse) » ou « Une poule offerte » ; « Graines de tournesol à moitié prix » ou « Le vendeur travaille un jour gratuit ».
- *Pourquoi* : petite décision agréable à chaque palier, variété d'une partie à l'autre, transforme le résumé (écran passif) en moment de jeu.
- *Chez nous* : parfait pour le mode Niveaux (rejouabilité des 12 années) et pour la Carrière.
- *Effort* : S-M. *Risque* : déséquilibre → effets modestes, tirés dans une table par niveau, vérifiés par `tools/simulate.js`.

**A6. Saisons et années « à thème » (événements de climat ou de marché)**
- *Sources* : Two Point (une mécanique mise en avant par niveau), Dorfromantik (modes défis).
- *Quoi* : en Carrière, chaque année tire un **thème** annoncé au printemps : « Année des abeilles » (miel +50 %), « Année sèche » (moins de pluie, arrosage valorisé), « Année du fromage » (comice orienté fromages), « Touristes en masse ».
- *Pourquoi* : casse la répétition année après année sans nouveau contenu.
- *Effort* : S-M. *Risque* : thème punitif → toujours une moitié positive.

**A7. Tâches de terrain en défrichant (surprises de la forêt)**
- *Sources* : Family Island, Klondike (défrichage, trésors), Dorfromantik (tuiles à quête cachées loin du départ).
- *Quoi* : chaque terrain de forêt acheté cache 1 à 3 « trouvailles » à révéler en touchant (souche → coffre de graines rares, vieux puits → eau gratuite, ruine → objet de collection, animal perdu à adopter).
- *Pourquoi* : l'achat d'un terrain devient un **moment de découverte**, pas une transaction.
- *Effort* : M. *Risque* : faible ; veiller à ce que ce soit un bonus, jamais nécessaire.

**A8. Personnages demandeurs récurrents (au-delà de Joseph)**
- *Sources* : Pocket Camp (habitants et amitié), Merge Mansion/Gardens (histoire par personnage).
- *Quoi* : 4 à 6 habitants du village (la boulangère, l'instituteur, la fromagère, la petite Léa) avec un **goût**, une petite histoire en 5 étapes et un niveau d'amitié ; leurs commandes alimentent le panneau (A1).
- *Pourquoi* : la variété vient des **personnalités** ; l'histoire donne un sens aux commandes (Merge Gardens a relancé son jeu ainsi).
- *Effort* : L (textes, portraits). *Risque* : trop de texte → bulles d'une phrase, histoire facultative.

**A9. Croisements et variétés (découverte)**
- *Sources* : Plant Tycoon (croisements), FarmVille 3 (races d'animaux).
- *Quoi* : deux parcelles voisines de cultures différentes ont une petite chance de donner une **variété** (tomate cerise, carotte violette, citrouille géante) qui vaut plus et entre dans l'album.
- *Pourquoi* : surprise, raison de varier la disposition du champ.
- *Effort* : M (sprites de variétés). *Risque* : optimisation obsessionnelle → chance modeste, révélée au moment de la récolte.

### B. Plus de plaisir et de surprise

**B1. Récolte surprise / « récolte d'or »**
- *Sources* : Hay Day (objets bonus en récoltant), Township (objets de collection en produisant).
- *Quoi* : à chaque récolte, petite chance (2-4 %) d'un bonus : légume doré (×3), objet de collection, outil, graine rare. Le bonus saute hors de la parcelle avec un son distinct.
- *Pourquoi* : récompense variable dans l'action la plus fréquente → elle reste intéressante à la 500ᵉ fois.
- *Effort* : S. *Risque* : machine à sous → montant modeste, jamais d'argent « jackpot ».

**B2. Petites activités secondaires (pêche à la mare, cueillette en forêt)**
- *Sources* : Hay Day (pêche niveau 27), Stardew, Pocket Camp (pêche, insectes).
- *Quoi* : à la mare (Carrière phase B), une ligne à lancer : appui long pour lancer, toucher au bon moment (fenêtre large, mode « auto » en accessibilité) ; poissons à collectionner, vendables ou pour une recette (soupe de poisson).
- *Pourquoi* : une activité **différente** pendant l'hiver ou en attendant une récolte.
- *Effort* : M-L. *Risque* : réflexes (contraire à l'intention) → fenêtre très large ou option « pêche tranquille » sans timing.

**B3. Visiteurs et animaux vivants dans la scène**
- *Sources* : Neko Atsume, Hay Day (visiteurs), Pocket Camp.
- *Quoi* : animaux sauvages (hérisson, renard, cigognes au printemps, chats) qui apparaissent selon le décor posé ; les toucher → petite animation + entrée dans l'album.
- *Pourquoi* : la ferme semble vivante ; donne un sens aux décorations.
- *Effort* : M. *Risque* : faible.

**B4. Mini-jeux de fête**
- *Sources* : Township (mini-jeux d'événement), Hay Day (événements).
- *Quoi* : chaque fête a sa petite activité de 30 s : lancer d'anneaux à la Fête du village, concours du plus gros légume (choisir sa meilleure citrouille), décoration du sapin au Marché de Noël.
- *Pourquoi* : marque le calendrier, souvenir propre à chaque fête.
- *Effort* : M par mini-jeu. *Risque* : coût de contenu → commencer par un seul.

**B5. Météo « cadeau » et moments rares**
- *Sources* : notre arc-en-ciel existant, Neko Atsume (visites rares), Stardew (événements rares).
- *Quoi* : enrichir la table d'événements rares et joyeux : étoile filante (un vœu = un petit bonus au choix), lucioles l'été, premier flocon, champignon géant.
- *Pourquoi* : surprise sans risque.
- *Effort* : S chacun. *Risque* : faible.

**B6. Humour et petites histoires**
- *Sources* : Hay Day (ton années 50, sauna à cochons), Two Point (maladies absurdes).
- *Quoi* : animations idiotes (vache qui danse sous la pluie, coq qui rate le lever), textes de commandes drôles, journal du village.
- *Pourquoi* : charme gratuit, identité.
- *Effort* : S-M. *Risque* : faible.

**B7. Le journal du village (gazette de saison)**
- *Sources* : Hay Day (journal), Stardew (télévision, lettres).
- *Quoi* : à chaque saison, une page : météo prévue, fête à venir, produit « à la mode » (cours haut), petite annonce d'un habitant (commande), anecdote sur la ferme du joueur (« Les tomates de [nom] font parler d'elles »).
- *Pourquoi* : regroupe l'information utile en un lieu agréable, donne envie de planifier.
- *Effort* : M. *Risque* : faible.

### C. Accessibilité et prise en main

**C1. Déblocage progressif de l'interface**
- *Sources* : Hay Day (fonctions débloquées par niveau), FTUE (PocketGamer.biz, Liquid & Grit), Two Point (une mécanique par niveau).
- *Quoi* : au début, seuls « Ferme » et la scène existent ; l'onglet « Acheter » apparaît à la première récolte vendue, « Bilan » au premier fermage, l'atelier au premier lait… avec un éclat « Nouveau ! ».
- *Pourquoi* : moins d'écrans vides et de choix au départ ; chaque nouveauté est un petit événement.
- *Effort* : M. *Risque* : frustrer les joueurs expérimentés → débloquer tout d'un coup si on a déjà fini le niveau 1 / option « tout montrer ».

**C2. Première minute « jouer d'abord »**
- *Sources* : FTUE best practices, Hay Day (pas de tutoriel imposé).
- *Quoi* : la toute première partie démarre **directement dans le champ** avec 3 parcelles déjà mûres : premier geste = glisser pour récolter, pièces qui volent → « aha » en 5 secondes. Le menu vient après.
- *Pourquoi* : 80-90 % des abandons se jouent dans la première utilisation.
- *Effort* : S-M. *Risque* : faible.

**C3. Indications dans le monde plutôt que bulles de texte**
- *Sources* : Kingdom Two Crowns (interface diégétique), Hay Day (bulles au-dessus des bâtiments prêts).
- *Quoi* : icônes au-dessus des choses qui attendent le joueur (œuf au-dessus du poulailler, goutte au-dessus d'une parcelle à arroser, point d'exclamation au-dessus de Joseph), main fantôme qui montre le geste la première fois.
- *Effort* : S-M. *Risque* : encombrement → n'afficher que l'essentiel, discrétion réglable.

**C4. Lisibilité des recettes et des chaînes**
- *Sources* : Hay Day (chaînes logiques), Merge (commande montre l'objet exact).
- *Quoi* : chaque recette en pictogrammes « 🥛 + 🧂 → 🧀 », ingrédient manquant entouré avec son origine (« lait : étable, 1 vache ») ; toucher un ingrédient manquant fait **défiler la scène jusqu'à sa source**.
- *Effort* : M. *Risque* : faible.

**C5. Le « conseiller » qui répond à « et maintenant ? »**
- *Sources* : Family Island (panneau d'objectifs), FTUE.
- *Quoi* : bouton « ? » ou Joseph au bord de l'écran qui propose **une seule** action utile selon l'état (« Tes tomates sont mûres », « L'hiver arrive dans 3 jours : plante des choux », « Tu peux acheter un poulailler »).
- *Pourquoi* : le joueur perdu ne décroche pas.
- *Effort* : M. *Risque* : jouer à la place du joueur → seulement sur demande ou en cas d'inactivité.

**C6. Paquet d'accessibilité de base**
- *Sources* : Game Accessibility Guidelines.
- *Quoi* : taille du texte réglable (100/125/150 %), mode contraste élevé, **formes en plus des couleurs** (fermage vert/orange/rouge + icône), sous-titres visuels des sons importants (coq de l'aube → petit soleil, alerte de gel → icône), « animations réduites » (existe), option « gestes simples » (toucher = action, pas de glisser obligatoire), écran d'aide qui liste ces options.
- *Effort* : M. *Risque* : faible.

**C7. Annulation bienveillante**
- *Sources* : pratique UX générale ; jeux cosy qui évitent l'erreur irréversible.
- *Quoi* : « Annuler » pendant 5 s après un achat ou une plantation par erreur (toast avec bouton).
- *Pourquoi* : sur téléphone, les touchers accidentels sont fréquents ; la règle « on assume ses choix » peut rester pour les décisions *réfléchies*.
- *Effort* : S-M. *Risque* : contourner l'arbitrage → limité à quelques secondes et à la dernière action.

**C8. Points d'arrêt et reprise**
- *Sources* : Cozy Grove (« tu peux revenir demain »), WoW (repos positif).
- *Quoi* : à la reprise d'une partie, un écran « Où en étais-je ? » (saison, objectif en cours, prochaine échéance, commande promise) ; à la fin de saison, un message clair « bon moment pour faire une pause, tout est sauvegardé ».
- *Effort* : S. *Risque* : aucun.

### D. Motivation à long terme

**D1. Albums de collection (« Le carnet de la ferme »)**
- *Sources* : Neko Atsume (album), Stardew (expéditions, musée), Township (collections, zoo), FarmVille 3 (races).
- *Quoi* : pages à silhouettes : **cultures et variétés** (A9), **produits** (chaque produit vendu au moins une fois), **animaux sauvages** vus (B3), **poissons** (B2), **trouvailles** (A7), **objets rares** (B1). Chaque page complétée donne un objet de décor unique ou un titre.
- *Pourquoi* : on progresse en jouant normalement, sans pression, et ça pousse doucement à essayer toutes les cultures et ateliers.
- *Effort* : M (le système) + contenu. *Risque* : objets trop rares → la dernière case doit rester atteignable (chance qui augmente avec les tentatives).

**D2. Paniers du village (« bundles » à la Stardew)**
- *Sources* : Stardew Valley (Centre communautaire).
- *Quoi* : à la mairie (ou l'église, le lavoir), des **paniers thématiques** : « Panier de printemps : 5 carottes, 3 navets, 1 miel », « Panier du fromager »… Chaque salle complétée **change le village pour toujours** (pont réparé → accès à la rivière/mare, lavoir rénové → arrosage gratuit, moulin → farine moins chère).
- *Pourquoi* : objectifs qui font explorer **toutes** les facettes du jeu et récompenses **visibles dans le monde**.
- *Chez nous* : idéal pour la Carrière (entre deux rangs), en remplacement ou complément des « 2 objectifs par rang ».
- *Effort* : M-L. *Risque* : objectifs trop longs → 3 à 5 objets par panier, les produits donnés sont payés (pas de perte sèche).

**D3. Paliers de quantité « bosselés »**
- *Sources* : AdVenture Capitalist / Egg Inc. (paliers qui doublent), Kongregate (progression bosselée).
- *Quoi* : « 5 poules : une poule rousse rejoint la basse-cour (+1 œuf/jour) » ; « 3 ruches : rayon de miel visible et pollinisation bonus » ; « 50 confitures faites : la confiture de mûres débloquée ».
- *Pourquoi* : les objectifs proches créent des « sauts » visibles au lieu d'une pente lisse.
- *Effort* : S-M. *Risque* : faible si modeste.

**D4. Héritage / transmission (alternative cosy au prestige)**
- *Sources* : Egg Inc. et AdVenture Capitalist (prestige), Dorfromantik (nouveaux biomes débloqués), notre mode Niveaux (étoiles permanentes).
- *Quoi* : après le rang Domaine, proposer **« Transmettre la ferme »** : on commence une **nouvelle ferme dans une autre région** (montagne, bord de mer, Provence : cultures et climats différents) en gardant décor, album, amitiés et une **« recette de famille »** (bonus permanent au choix). L'ancienne ferme reste visitable (lecture seule) dans l'album.
- *Pourquoi* : relance la boucle avec de nouvelles contraintes sans effacer ce qu'on a construit (le prestige classique « tout perdre » est contraire à l'esprit cosy).
- *Effort* : L. *Risque* : contenu de région à produire → commencer par une variante de climat sur les données existantes.

**D5. Records personnels et « ferme de l'année »**
- *Sources* : Islanders (score transparent), jeux d'arcade.
- *Quoi* : en fin d'année, comparaison avec ses propres années précédentes (« meilleure récolte de tomates », « année la plus rentable »), petite médaille si un record tombe ; frise des années (miniature de la ferme chaque hiver).
- *Pourquoi* : se battre contre soi, sans classement en ligne ; la **frise des miniatures** montre la croissance (très motivant en Carrière).
- *Effort* : S-M. *Risque* : faible.

**D6. Succès qui débloquent du contenu (et pas seulement des écus)**
- *Sources* : Dorfromantik (succès → nouvelles tuiles, biomes), Two Point (Kudosh → objets).
- *Quoi* : certains succès débloquent une culture de collection, un animal de compagnie, une musique, un thème de saison, une palette de décor.
- *Effort* : S par récompense. *Risque* : faible.

### E. Juiciness (retours sensoriels)

**E1. Pièces qui volent vers le compteur**
- *Sources* : quasi tous (Hay Day, Township, idle), *Juice it or lose it*.
- *Quoi* : à la vente/récolte, 3 à 8 pièces jaillissent et courent vers l'argent du HUD (courbe d'interpolation), le compteur roule et pulse.
- *Effort* : S. *Risque* : lenteur → animation de 0,4-0,6 s qui n'empêche aucune action ; respect de « animations réduites ».

**E2. Combo musical de récolte**
- *Sources* : jeux de rythme et de puzzle (cascade de notes), Dorfromantik (soigner l'action la plus fréquente).
- *Quoi* : pendant un glisser, chaque parcelle récoltée joue une note un peu plus haute (gamme pentatonique pour que ce soit toujours joli) ; au-delà de 8, petit « tadaa » et étincelles.
- *Pourquoi* : le geste de série devient un plaisir et pas une corvée.
- *Effort* : S. *Risque* : fatigue sonore → sons doux, volume des effets séparé.

**E3. Écrasement-étirement et rebonds**
- *Sources* : *Juice it or lose it*.
- *Quoi* : la culture mûre « sautille » doucement, la parcelle récoltée s'écrase puis rebondit, le bâtiment acheté tombe du ciel avec un petit nuage de poussière, les animaux sautent quand on ramasse.
- *Effort* : S-M. *Risque* : faible ; « animations réduites ».

**E4. Grands moments célébrés**
- *Sources* : jeux mobiles en général.
- *Quoi* : rang atteint, album complété, première année → plein écran court (2 s) avec confettis, fanfare douce, et une **photo de la ferme** qu'on peut garder.
- *Effort* : S-M. *Risque* : trop fréquent → réserver aux vrais jalons.

**E5. Vibrations courtes contextuelles**
- *Quoi* : 10 ms à la récolte, 20 ms à la vente, motif doux pour un rang ; réglable (existe déjà en partie).
- *Effort* : S. *Risque* : faible.

### F. Raccourcis d'UX qui suppriment les corvées

**F1. « Tout ramasser » contextuel**
- *Sources* : jeux idle (collect-all), Hay Day.
- *Quoi* : quand au moins 2 sources sont prêtes (œufs, lait, ateliers finis), un bouton flottant « Ramasser tout (7) » au-dessus des onglets ; toucher = tout récolter avec les pièces qui volent.
- *Effort* : S. *Risque* : rendre les collecteurs/employés inutiles → le réserver à ce qui est **à l'écran**, ou le débloquer avec le rang 2 (les machines gardent leur intérêt : agir sans le joueur).

**F2. Glisser étendu aux animaux et ateliers**
- *Sources* : Hay Day (un outil, un glisser).
- *Quoi* : le glisser qui récolte le champ ramasse aussi sur les abris ; glisser un produit depuis le grenier vers un atelier pour le lancer.
- *Effort* : M. *Risque* : conflit avec le défilement → même règle que le champ (un glisser qui commence sur une cible agit, sinon défile).

**F3. « Refaire la même chose » / plans de culture mémorisés**
- *Sources* : Farming Simulator (plans), idle (auto-répétition), notre « Semer partout ».
- *Quoi* : après une récolte, bouton « Replanter pareil » ; en Carrière, plan par terrain (déjà prévu § 3.4) avec un gros bouton « Appliquer le plan ».
- *Effort* : S. *Risque* : faible.

**F4. File d'attente d'atelier**
- *Sources* : Hay Day (files de production visibles).
- *Quoi* : on met 3 à 5 lancements en file sur un atelier ; ils s'enchaînent seuls tant qu'il y a des ingrédients.
- *Effort* : S-M. *Risque* : faible.

**F5. « Passer à l'aube » / vitesse ×8 quand rien à faire**
- *Sources* : Stardew (dormir), Mini Metro (vitesse).
- *Quoi* : bouton « Jusqu'à demain » quand toutes les actions du jour sont faites ; vitesse ×8 en hiver.
- *Pourquoi* : supprime l'attente vide (notre « minuteur ») ; alternative honnête à la progression hors ligne.
- *Effort* : S. *Risque* : rater un événement → s'arrêter automatiquement sur tout message important.

**F6. Livraison intelligente**
- *Sources* : Travel Town (coche verte quand on a l'objet), Hay Day.
- *Quoi* : coche verte sur toute commande/quête/panier qu'on peut livrer **maintenant**, avec bouton « Livrer » direct depuis la notification.
- *Effort* : S. *Risque* : aucun.

**F7. Notifications regroupées**
- *Quoi* : à l'aube, un seul toast résumé (« +34 pièces, 6 œufs, Joseph passe demain ») plutôt que plusieurs.
- *Effort* : S. *Risque* : aucun.

---

## 4. Les 15 mécaniques les plus prometteuses (classées)

| # | Mécanique | Groupe | Effort | Pourquoi en priorité |
|---|---|---|---|---|
| 1 | **Tableau de commandes du village** (A1) | Variété | M | Le moteur de variété n°1 du genre ; donne toujours un but proche |
| 2 | **Choix entre deux améliorations en fin de saison** (A5) | Variété | S-M | Rend chaque partie différente, transforme un écran passif en décision ; rejouabilité des 12 niveaux |
| 3 | **Pièces qui volent + combo musical de récolte** (E1+E2) | Juiciness | S | Rend l'action la plus fréquente plaisante (règle de Dorfromantik) |
| 4 | **Albums de collection** (D1) | Long terme | M | Motivation sans stress, fait essayer toutes les cultures et tous les ateliers |
| 5 | **Récolte surprise** (B1) | Surprise | S | Récompense variable dans le geste le plus répété |
| 6 | **Charrette à caisses** (A2) | Variété | M | Objectif de moyen terme qui pousse à diversifier ; récompense non monétaire |
| 7 | **Défis de saison au choix** (A4) | Variété / régularité | M | « Derby » solo : remplace les quotidiens/hebdos sans série punitive |
| 8 | **Paniers du village qui changent le monde** (D2) | Long terme | M-L | Objectifs explorant toutes les facettes ; récompenses visibles |
| 9 | **Déblocage progressif de l'interface + première minute dans le champ** (C1+C2) | Prise en main | M | Moins de surcharge au départ ; « aha » en 5 secondes |
| 10 | **« Tout ramasser » et glisser étendu** (F1+F2) | Raccourcis | S-M | Supprime la corvée des animaux et ateliers |
| 11 | **« Jusqu'à demain » / ×8 + « Où en étais-je ? »** (F5+C8) | Raccourcis / reprise | S | Alternatives propres à la progression hors ligne |
| 12 | **Lisibilité des recettes, saut vers la source** (C4) | Accessibilité | M | Chaînes de production comprises sans tutoriel |
| 13 | **Trouvailles en défrichant les terrains** (A7) | Surprise | M | L'achat d'un terrain devient une découverte |
| 14 | **Années à thème en Carrière** (A6) | Variété | S-M | Casse la répétition annuelle avec peu de contenu |
| 15 | **Paquet d'accessibilité de base** (C6) | Accessibilité | M | Texte réglable, formes + couleurs, sous-titres visuels : public plus large |

**Ordre de réalisation suggéré** :
1. *Lot rapide (S)* : E1+E2, B1, F5, C8, F6, F7 — gros effet ressenti, peu de risque.
2. *Lot variété (M)* : A1 puis A5, puis A2 et A4 (partagent le générateur de demandes « réalisables cette saison »).
3. *Lot long terme (M-L)* : D1 (albums) alimenté par B1, A7, A9 ; puis D2 (paniers).
4. *Lot prise en main et accessibilité (M)* : C1, C2, C4, C6.
5. *Plus tard (L)* : A8 (habitants), B2 (pêche), D4 (héritage).

Chaque lot passe par `tools/simulate.js` (nouvelles stratégies de robots : « suit les commandes », « choisit toujours l'amélioration la plus rentable ») pour vérifier que les gains restent modestes.

---

## 5. Pièges à éviter (ce que ces jeux font et que nous ne devons pas copier)

- **Énergie, stockage étroit, minuteurs longs** : n'existent que pour vendre ; chez nous ils rendraient le jeu plus pénible sans aucune contrepartie.
- **Séries de connexion punitives** et récompenses quotidiennes qui se perdent : transforment le plaisir en obligation (Smashing Magazine 2026).
- **Compte à rebours qui démarre sans accord** : notre règle Joseph (le délai commence à l'acceptation) est la bonne ; l'appliquer à toute nouvelle demande.
- **Trop de systèmes à la fois** : la leçon de Hay Day est de polir l'existant ; chaque nouvelle mécanique doit réutiliser les mêmes produits et la même boucle (commandes, charrette, défis, paniers puisent tous dans les mêmes récoltes).
- **Ambiguïté des gestes** (Stardew mobile) : toute nouvelle interaction respecte « un geste = une intention ».
- **Prestige « tout perdre »** : contraire à l'esprit cosy ; préférer l'héritage (D4).
- **Classements en ligne / social** : hors sujet pour un jeu solo hors ligne ; les remplacer par records personnels et frise des années (D5).
- **Récompenses aléatoires trop fortes** : elles deviennent une machine à sous ; garder les surprises petites et fréquentes.

---

## 6. Sources

**Hay Day**
- Deconstructor of Fun — *Behind the Success of Hay Day* : https://www.deconstructoroffun.com/blog//2013/01/behind-success-of-hay-day.html
- mobilegamer.biz — *What Supercell's Hay Day team learned from ten years of updates* : https://mobilegamer.biz/what-supercells-hay-day-team-learned-from-ten-years-of-updates/
- PocketGamer.biz — *Supercell: looking back on 10 years of Hay Day* : https://www.pocketgamer.biz/supercell-looking-back-10-years-of-hay-day-part-one/
- AOL/Engadget — *Hay Day brings gesture based farming to the palm of your hand* : https://www.aol.com/2012/06/22/hay-day-iphone-ipad/
- Supercheats — Docks and boat : https://www.supercheats.com/hay-day/walkthrough/docks-and-boat ; Roadside shop : https://www.supercheats.com/hay-day/walkthrough/roadside-shop
- Sportskeeda — Derby tips : https://www.sportskeeda.com/esports/5-tips-completing-hayday-s-derby-event
- Wiki Hay Day (Fandom, lecture refusée, recoupé) : https://hayday.fandom.com/wiki/Daily_Dirt , https://hayday.fandom.com/wiki/Mailbox
- Wikipédia : https://wikipedia.com/wiki/Hay_Day

**Township, FarmVille 3, Family Island, Klondike**
- Wikipédia Township : https://en.wikipedia.org/wiki/Township_(video_game)
- Game World Observer — Township : https://gameworldobserver.com/2016/08/05/township
- Old Cynic — Township review : https://oldcynic.com/township-review-farming-match-3-mobile-game
- God is a Geek — FarmVille 3 launch : https://godisageek.com/2021/11/farmville-3-launches-on-ios-and-android-today/
- MuMu — Family Island beginner guide : https://www.mumuglobal.com/blog/family-island-beginner-guide.html
- Clubic — Family Island : https://www.clubic.com/telecharger-fiche445713-family-island.html
- App Store — Klondike Adventures : https://apps.apple.com/us/app/klondike-adventures-farm-game/id1127240206

**Fusion (merge)**
- Naavik — *Merge Mansion: the future of merge* : https://naavik.co/deep-dives/merge-mansion-future-of-merge/
- Deconstructor of Fun — *Deconstructing Merge Garden* : https://www.deconstructoroffun.com/blog/2023/10/22/deconstructing-merge-garden
- Elite Game Developers — *Designing a merge game* : https://elitegamedevelopers.substack.com/p/egd-news-85-designing-a-merge-game
- WN Hub — Merge Gardens restart : https://wnhub.io/news/investment/item-43468

**Stardew, Pocket Camp, Neko Atsume, Cozy Grove**
- Wiki Stardew — Mobile Controls : https://stardewvalleywiki.com/Mobile_Controls ; Bundles : https://stardewvalleywiki.com/Bundles ; Shipping : https://stardewvalleywiki.com/shipping ; Museum : https://stardewvalleywiki.com/Museum
- TouchArcade — Stardew mobile controls update : https://toucharcade.com/2018/11/01/stardew-valley-mobile-controls-update/
- Pocket Gamer — Stardew Valley review : https://www.pocketgamer.com/articles/079085/stardew-valley-review/
- Gamezebo — Pocket Camp review : https://www.gamezebo.com/2017/11/23/animal-crossing-pocket-camp-review-home/
- Pocket Gamer — Pocket Camp friendship tips : https://www.pocketgamer.com/animal-crossing-pocket-camp/animal-crossing-pocket-camp-tips-and-tricks-maxing-friendship-levels-filling-you/
- Vice — *Cozy Grove is OK telling players to log off* : https://broadly.vice.com/en/article/bvx9vw/cozy-grove-is-ok-telling-players-to-log-off-its-delightful
- Siliconera — Cozy Grove interview : https://siliconera.com/?p=876221

**Idle / incrémental**
- Game Developer — *The Math of Idle Games* I, II, III (Anthony Pecorella) : https://www.gamedeveloper.com/design/the-math-of-idle-games-part-i , https://www.gamedeveloper.com/disciplines/the-math-of-idle-games-part-ii , https://www.gamedeveloper.com/design/the-math-of-idle-games-part-iii
- Wikipédia — Egg, Inc. : https://en.wikipedia.org/wiki/Egg,_Inc. ; Incremental game : https://en.wikipedia.org/wiki/Incremental_game
- Wiki Egg Inc. — Prestige : https://egg-inc.fandom.com/wiki/Prestige?oldid=9210 ; Contracts : https://egg-inc.fandom.com/wiki/Contracts?oldid=9822
- App Store — Idle Farm Tycoon : https://apps.apple.com/pk/app/idle-farm-tycoon-merge-game/id1531074008

**Constructions relaxantes et gestion légère**
- Game Developer — *Sparking joy through tile placement in Dorfromantik* : https://www.gamedeveloper.com/disciplines/sparking-joy-through-tile-placement-in-idyllic-village-builder-i-dorfromantik-i-
- Wikipédia — Dorfromantik : https://en.wikipedia.org/wiki/Dorfromantik
- GDC — *Mini Metro: When Less Is More* : https://gdconf.com/news/attend-gdc-2017-and-learn-the-value-of-less-is-more-from-a-mini-metro-dev
- Tampere Playlab — Mini Metro : https://blogs.tuni.fi/playlab/game-reviews/mini-metro-bite-sized-puzzle-strategy-game-wrapped-in-a-minimalistic-atmosphere-of-transit-craze/
- Wikipédia — Islanders : https://en.wikipedia.org/wiki/Islanders_(video_game)
- Game Developer — *How Townscaper works* : https://gamedeveloper.com/blogs/how-townscaper-works-a-story-four-games-in-the-making
- Into the Spine — Townscaper : https://intothespine.com/2020/09/21/creativity-and-relaxation-townscaper/
- Wikipédia — Two Point Hospital : https://en.wikipedia.org/wiki/Two_Point_Hospital
- Pure Nintendo — Kingdom Two Crowns : https://purenintendo.com/review-kingdom-two-crowns-nintendo-switch/
- Steam — Plant Tycoon : https://store.steampowered.com/app/16120/

**Prise en main, juiciness, accessibilité, UX**
- Liquid & Grit — *Designing streamlined FTUEs* : https://www.liquidandgrit.com/designing-streamlined-ftues-to-maximize-early-retention/
- AdInMo — *First Time User Experience* : https://adinmo.com/first-time-user-experience-why-it-matters-and-how-to-get-it-right
- PocketGamer.biz — *Creating the ultimate FTUE* : https://www.pocketgamer.biz/first-impressions-count-creating-the-ultimate-first-time-user-experience
- Roblox Creator Docs — Onboarding : https://create.roblox.com/docs/production/game-design/onboarding
- RPG Playground — *Making a juicy game* (résumé de *Juice it or lose it*) : https://rpgplayground.com/research-making-a-juicy-game/
- GDQuest — Juicing : https://school.gdquest.com/glossary/juicing
- Game Accessibility Guidelines (niveau de base) : https://gameaccessibilityguidelines.com/basic/
- Smashing Magazine — *How To Design Mobile Apps For One-Hand Usage* : https://smashingmagazine.com/2020/02/design-mobile-apps-one-hand-usage/
- Parachute Design — *Thumb zone UX* : https://parachutedesign.ca/blog/thumb-zone-ux/
- Smashing Magazine — *Designing a streak system* (2026) : https://smashingmagazine.com/2026/02/designing-streak-system-ux-psychology/
- Psychology of Games — *Framing and World of Warcraft's rest system* : https://www.psychologyofgames.com/2010/03/framing-and-world-of-warcrafts-rest-system/
