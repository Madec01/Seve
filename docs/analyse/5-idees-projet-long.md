# Un grand projet à long terme pour le mode Carrière — pistes originales

Date : 2026-10-02. Document d'idéation (aucun fichier du projet modifié).

Sources lues : `docs/CARRIERE.md`, `docs/analyse/0-SYNTHESE.md`, `docs/analyse/2-jeux-cosy.md`, `docs/analyse/3-jeux-mobiles.md`, `JOURNAL.md` (« Idées » et idées écartées).

---

## 0. Le problème à résoudre, et les contraintes

**Constat de l'analyse** : après quelques années, la ferme se mécanise, gagne seule (+5 500 à +6 300 pièces par an sans rien toucher), remporte le comice toute seule, et l'argent n'a plus de sens une fois les 16 terrains, le Manoir et les ateliers niveau 5 achetés. La piste D2 de la synthèse (« restauration du village par paniers ») est écartée par le propriétaire : *« Trouvons une autre idée pour ne pas simplement copier un autre jeu. »*

**Ce qu'un bon grand projet doit faire** (tiré des études) :

1. **Donner un sens à l'argent** en fin de partie, de façon agréable (puits d'argent « pour la beauté » ou « pour les autres »), pas une taxe.
2. **Remettre le joueur au centre** : des décisions et des gestes que ni les employés ni les machines ne font à sa place.
3. **Créer de la variété et de la surprise** d'une année à l'autre (contre la routine « une culture domine »).
4. **Transformer visiblement la carte** (la ferme vue de dessus, en portrait, carte 2D de 5 colonnes × 6 rangées + côtés).
5. **S'appuyer sur l'existant** : saisons, Joseph et ses ♥, ateliers, animaux, employés, machines, fêtes, comice, 6 rangs jusqu'au Domaine, écus, album (D1) et lanternes (D3) prévus.
6. **Respecter l'identité** : Détente sans fin de partie, rien ne se perd, pas de compte à rebours stressant, pas d'énergie, pas de progression hors ligne, sessions de 5 à 15 minutes, tout au pouce (≥ 48 px), aucun tirage aléatoire en mode Niveaux, logique pure dans `src/core`.
7. **Être un arc de plusieurs années** : commencer vers le rang 2-3 pour qu'il porte aussi la montée vers le Domaine, et continuer **après** le Domaine (le jeu libre actuel est vide).

**Ce qu'il faut éviter** : copier les paniers de Stardew (« une de chaque chose → une salle réparée »), le bateau à remplir de Hay Day, le musée d'Animal Crossing tel quel, le prestige qui fait tout perdre, les monnaies multiples, les classements.

---

## 1. Les concepts

Effort : **S** (quelques jours d'agents), **M** (un lot), **L** (gros lot, plusieurs agents), **XL** (refonte ou nouveau monde à dessiner).

---

### 1.1 La Grainothèque vivante

**Pitch.** Joseph vous confie une vieille boîte en fer : des graines de variétés anciennes du pays, presque perdues. Au fil des années, vous les faites revivre, vous les **croisez** dans vos champs pour obtenir de nouvelles variétés (une tomate « Cœur des Tilleuls » qui supporte la canicule, un chou qui pousse sous la neige), et vous bâtissez une grainothèque que toute la vallée vient consulter. Votre héritage, ce sont des graines qui portent votre nom.

**Mécanique (téléphone).**
- Chaque culture existante gagne des **variétés** (3 à 6 par culture, ~40 au total) avec 1 ou 2 **traits** lisibles en pictogrammes : *précoce* (−1 jour), *rustique* (insensible au gel), *assoiffée / sobre*, *généreuse* (+1 récolte de qualité), *de garde* (cours au grenier +10 %), *parfumée* (atelier +15 %), *mellifère* (abeilles).
- **Croiser** : deux parcelles voisines de deux variétés de la même culture, récoltées **à la main** le même jour, ont une chance de donner un **sachet de graines croisées** (pas de mini-jeu : la récolte d'un glissé suffit, c'est la disposition qui compte). Le sachet est une surprise : on le sème pour découvrir la variété (silhouette grise dans la grainothèque jusqu'à la première récolte). Les croisements suivent une **table fixe en données** (comme une recette) : rejouable, devinable, transmissible entre joueurs à l'oral.
- **Faire revivre** une variété ancienne : la semer et la récolter N fois (ex. 3 récoltes) pour « fixer » la semence ; avant, les graines ne s'achètent pas, on les garde de récolte en récolte.
- **Le bâtiment** : la Grainothèque (sur un emplacement de cour des ateliers ou de pré), 5 niveaux ; chaque niveau ajoute des tiroirs (pages) et un effet : graines gratuites d'une variété fixée par jour, demandes de voisins (« Mme Rose cherche une courge qui tient l'hiver »), échanges avec d'autres villages.
- **Session type** : on vérifie un sachet trouvé, on décide où le semer (feuille « Plan de culture » enrichie d'un sélecteur de variété), on récolte à la main la planche d'essai, on range une variété fixée.

**Sens de l'argent / fin de partie.** Achats de variétés anciennes au marchand ambulant (C7) et aux autres villages, niveaux de la Grainothèque (2 000 → 25 000), parcelles d'essai sous serre, « jardin conservatoire » (terrain dédié, purement collection). Après le Domaine : compléter les ~40 variétés, dont 8 **variétés légendaires** obtenues par croisements en chaîne (3 générations).

**Variété et surprise.** Casse directement le problème n° 1 de l'analyse (« une culture domine, la récolte ne réserve aucune surprise ») : la meilleure culture dépend maintenant des traits, de la saison et de la météo ; chaque sachet est un petit cadeau ; l'année de canicule devient l'année où l'on teste la variété *sobre*.

**Sur la carte.** Les cultures changent d'apparence selon la variété (recoloration de palette des sprites existants : tomate jaune, carotte violette, citrouille bleue « Galeuse »), planches d'essai à étiquettes en bois, Grainothèque en pierre avec un tilleul, rangées multicolores dans les champs. Le champ cesse d'être une seule couleur.

**Liens avec l'existant.** Récolte à la main (F1 : le croisement **exige** la main → le toucher garde du sens même mécanisé), album (D1 : une case par variété), comice (épreuve « présenter 3 variétés anciennes »), ruches (trait mellifère), ateliers (trait parfumé), quêtes de Joseph (« retrouve la poire de mon père »), lanternes (critère « variété »), serre (croiser en hiver).

**Originalité.** Plant Tycoon et FarmVille 3 ont des croisements, mais comme collection hors-sol ; Stardew a des graines mystères aléatoires. Ici, le croisement naît **de la disposition des champs vus de dessus** (voisinage de parcelles) et sert la **conservation de variétés anciennes réelles** (thème patrimonial, très français : Kokopelli, conservatoires régionaux). Personne ne fait de la sélection paysanne le cœur d'un jeu cosy.

**Effort : L.** Données (variétés, traits, table de croisement), règle de voisinage dans `farm.js`, flux aléatoire `career`, grainothèque (feuille), recoloration de sprites, simulation d'équilibrage des traits.
**Risques.** Complexité (trop de variétés tue la lisibilité : limiter à 3 visibles par culture au départ, déblocage progressif) ; équilibre (un trait trop fort redevient dominant) ; la plantation en série par « Semer partout » doit garder la variété choisie par terrain.

---

### 1.2 La Vallée qui revient

**Pitch.** Quand vous arrivez, la vallée autour de la ferme est fatiguée : plaine nue, ruisseau à sec, plus un oiseau. Chaque haie plantée, chaque mare creusée, chaque bande fleurie fait revenir quelqu'un : le hérisson, la chouette, les papillons, la loutre, un jour le héron, et enfin, au bout de dix ans, les cigognes sur le toit du Manoir. La carte autour de la ferme verdit, littéralement, année après année.

**Mécanique (téléphone).**
- Un indicateur doux : la **vie de la vallée** (pas un score affiché en gros : une rangée de silhouettes d'animaux sauvages, grises tant qu'ils ne sont pas venus).
- Des **aménagements nature** posés sur des emplacements prédéfinis (pas de placement libre, cf. idées écartées) : haie sur la lisière d'un terrain, bande fleurie en bout de champ, mare, nichoirs, tas de bois, arbre isolé, jachère fleurie (une parcelle laissée en fleurs sauvages une saison), rucher sauvage, passe à poissons.
- Chaque espèce sauvage a une **recette d'habitat** lisible (« Le hérisson vient si : 2 haies + 1 tas de bois + aucune machine sur le terrain voisin la nuit ») et se découvre par indices (« On a vu des traces près de la haie… »). Elle s'installe à l'aube, toujours définitivement.
- Les animaux sauvages **rendent des services doux** : coccinelles (protègent des maladies), chouette (plus de corbeaux), chauve-souris (moins de nuisibles en été), vers de terre (pousse +5 % sur un terrain en rotation), pollinisateurs (qualité B2). Jamais d'effet négatif.
- **Terres sauvages** : au-delà des 16 terrains, des blocs de lisière qu'on n'achète pas pour produire mais pour **rendre à la nature** (bois, marais, prairie). C'est un puits d'argent aimé : on paie pour que ce soit beau et vivant.
- **Session type** : regarder qui est venu ce matin (petite scène), poser une haie avec l'argent de la saison, laisser un coin en jachère dans le plan de culture, lire l'indice du jour.

**Sens de l'argent / fin de partie.** Haies, mares, arbres, terres sauvages, restauration du ruisseau (gros chantier en 4 étapes, 5 000 → 40 000), observatoire. L'argent achète de la vie, pas du rendement : exactement le « but pour la beauté » de la synthèse. Après le Domaine : ~30 espèces, dont quelques **visiteurs rarissimes** (cigogne, cerf blanc, martin-pêcheur) qui deviennent des souvenirs.

**Variété et surprise.** Chaque aube peut amener une première visite ; les saisons changent qui est là (hirondelles au printemps, grues en automne, rouge-gorge en hiver) ; l'équilibre productivité / nature crée de vrais choix (une jachère rapporte moins mais attire le lièvre ; un tracteur la nuit fait fuir le hérisson). Rend l'hiver vivant (C8) : traces dans la neige, oiseaux aux mangeoires.

**Sur la carte.** Le plus fort de tous les concepts : la forêt et les bords de carte (aujourd'hui décor fixe) **changent** — prairie sèche → herbe verte → fleurs ; ruisseau à sec qui se remplit et serpente entre les terrains ; animaux qui traversent l'écran ; cigognes sur le Manoir. Un écran « avant / après » au bilan annuel (vignette de la vallée l'année 1 à côté de l'année N).

**Liens avec l'existant.** Ruches, mare et canards (phase B), verger, pêche (le ruisseau restauré donne des poissons), corbeaux (la chouette), maladies et météo, album (D1 : page faune), lanternes (critère « beauté » ou « nature »), comice (prix spécial « ferme accueillante »), Joseph (« Quand j'étais petit, il y avait des écrevisses ici »), machines (choix entre vitesse et calme), carte 2D (les côtés).

**Originalité.** Cozy Grove rend la couleur à une île hantée par un fil narratif ; Animal Crossing attire des insectes par le hasard ; Stardew n'a pas d'écologie. Ici, la nature revient **en réponse à des choix d'aménagement agricoles réels** (agroécologie : haies, bandes enherbées, mares — ce que font de vrais paysans) et la ferme-machine du milieu de partie devient une ferme-paysage. C'est la réponse exacte à « la ferme se joue toute seule » : la nature, elle, ne s'automatise pas.

**Effort : L à XL.** Logique simple (recettes d'habitat = règles en données), mais beaucoup de graphismes : ~30 animaux sauvages (petits, 1 × 1, quelques images), haies, mares, ruisseau en autotuiles, états de végétation de la lisière, rendu des bords de carte.
**Risques.** Volume d'art ; lisibilité des recettes (afficher toujours l'indice suivant) ; ne pas culpabiliser (aucune espèce ne repart jamais) ; performance des animaux qui se promènent (plafonner le nombre dessiné).

---

### 1.3 La Saga des Tilleuls (la ferme de famille)

**Pitch.** Votre carrière n'est pas celle d'un fermier : c'est celle d'une **famille**. Tous les 7 ans, le fermier passe la main à la génération suivante, qui hérite de la ferme entière et d'un **objet de famille** choisi par son aîné. Chaque génération a son caractère, son portrait au mur, et sa façon d'aimer la terre ; au bout de quatre générations, la ferme a une histoire.

**Mécanique (téléphone).**
- **Une génération = 7 ans** (≈ 70 minutes de jeu à ×1). À la fin de la 7e année, après le bilan, une scène douce : le fermier s'installe sur le banc du perron (il reste dans le décor, comme Joseph, et donne des conseils), l'enfant devenu grand reprend.
- **Rien ne se perd** (pas un prestige) : argent, terrains, bâtiments, animaux, employés restent. Ce qui change :
  - le **nouveau fermier** a un **talent** tiré parmi 3 proposés (on choisit) : « Main verte » (qualité), « Éleveuse » (animaux), « Bricoleur » (machines −carburant), « Sociable » (Joseph, visiteurs), « Botaniste » (croisements)… ; un style de jeu différent par génération = variété sur dix ans ;
  - l'**objet de famille** transmis : la faux du grand-père (récolte à la main +5 %), le carnet de recettes de la grand-mère, la cloche de la ferme, le premier écu, la montre… ; ils s'accumulent dans la « vitrine » de la maison et leurs effets se cumulent doucement ;
  - un **vœu de génération** : en début de génération, le nouveau fermier choisit un rêve (« avoir 8 espèces », « ouvrir l'auberge », « faire revenir la cigogne ») ; le réaliser avant de passer la main donne l'objet de famille le plus beau.
- **Session type** : rien de neuf au quotidien ; un objectif « vœu » toujours visible ; la passation est un moment fort tous les 7 ans.

**Sens de l'argent / fin de partie.** Le vœu oriente les dépenses ; un **arbre généalogique** à embellir (portraits, mariages avec des gens du village, frères et sœurs qui deviennent employés). Après le Domaine : continuer la lignée (5e, 6e génération), chaque génération repose la question « que veut-on faire de la ferme ? ».

**Variété et surprise.** Chaque génération change la manière de jouer (talent + vœu) ; les enfants naissent et grandissent dans la ferme (petit sprite qui suit le fermier, puis aide aux corvées) ; anecdotes familiales.

**Sur la carte.** La maison s'agrandit avec la famille (balançoire, linge qui sèche, cabane dans l'arbre), les anciens sur le banc, une **petite tombe fleurie ou un arbre du souvenir** sous un tilleul à planter par génération (sujet délicat : à traiter avec un arbre planté « en l'honneur de », pas une tombe), la vitrine des objets.

**Liens avec l'existant.** Rangs (le titre passe de génération en génération : « Marie, 3e génération, Seigneur du domaine »), Joseph (vieillit aussi ; son petit-fils prend la ferme voisine), employés (les enfants peuvent être embauchés), succès, bilan annuel, album (page « Famille »), option « Fermière » (le genre se choisit à chaque génération).

**Originalité.** Stardew a un grand-père qui juge, Harvest Moon a des enfants décoratifs, Crusader Kings ou Rogue Legacy ont des lignées mais pas cosy. Une **lignée agricole qui transmet sans rien perdre**, avec choix de talent et vœu par génération, n'existe pas dans le genre. C'est aussi la vraie histoire d'une ferme française (« la ferme est dans la famille depuis quatre générations »).

**Effort : M à L.** Logique légère (génération, talent, objets, vœu), portraits à dessiner (4 à 6 visages × âges), scène de passation, vitrine.
**Risques.** Thème du vieillissement et de la mort (garder un ton tendre : retraite sur le banc, pas de décès) ; attachement au premier fermier (le garder visible et parlant) ; 7 ans peut paraître long (option 5 ans).

---

### 1.4 La Table des Tilleuls (de la ferme à l'assiette)

**Pitch.** La chambre d'hôte devient, petit à petit, une **auberge de campagne** où l'on ne sert que ce que la ferme produit. Vous composez un **menu de saison** avec vos légumes, vos fromages, vos œufs et vos truffes, et les clients reviennent, racontent, écrivent dans le livre d'or ; un jour, le guide gastronomique passe.

**Mécanique (téléphone).**
- **Le menu** : 3 cases (entrée, plat, dessert) à remplir avec des **plats** = associations de 2 à 3 produits (« velouté de citrouille et crème », « omelette aux truffes », « tarte aux pommes et miel »). Les plats se **découvrent** en essayant (comme la cuisine D4) et dépendent de la saison.
- Une fois le menu posé, l'auberge fonctionne seule chaque jour (consomme le stock du grenier, rapporte plus que la vente) : ce qui compte, c'est la **décision du menu une fois par saison**, et la variété (un menu répété perd de son attrait, un menu de saison en gagne).
- **Clients nommés** qui reviennent (le randonneur, la famille parisienne, le critique) avec leurs envies (« il ne mange pas de viande », « elle adore les fraises ») : petites demandes à satisfaire au menu.
- **La réputation** de l'auberge : étoiles de 1 à 5 (pas de perte), par la variété des produits, la qualité, les produits « maison » (atelier) et la cohérence avec la saison.
- **Session type** : en début de saison, composer le menu (feuille du bas, glisser les produits dans les cases) ; ensuite, lire le livre d'or, ramasser les pourboires.

**Sens de l'argent / fin de partie.** Agrandir l'auberge (salle, terrasse, cave, four à bois, potager du chef), embaucher un cuisinier (nouveau métier), décorer la salle. Fin : le guide (« Une étoile verte »), la grande table du banquet de la fête des récoltes.

**Variété et surprise.** Le menu change à chaque saison ; les clients apportent de petites histoires ; un plat découvert par hasard. Donne une raison de **diversifier** la production (un menu demande plusieurs produits) : anti-monoculture.

**Sur la carte.** L'auberge grandit sur un pré (terrasse avec parasols en été, lumières le soir, fumée de la cheminée en hiver), clients qui arrivent par la route et se promènent dans la ferme.

**Liens avec l'existant.** Chambre d'hôte (devient le niveau 1), grenier (stock), ateliers (produits), animaux, truffes, vendeur, fêtes (banquet), visiteurs et touristes (événements), qualité (B2), cuisine (D4).

**Originalité.** Hay Day a un « diner » (commandes) mais pas de menu choisi ; Stardew a un saloon qui ne vous appartient pas. Moyennement original (les jeux de restaurant existent) ; l'angle « menu de saison 100 % ferme » est le bon.

**Effort : M.** Réutilise la chambre d'hôte, le grenier, la cuisine D4.
**Risques.** Superposition avec la cuisine D4 et les commandes C1 ; peut devenir un second jeu de gestion ; faible transformation de la carte (un seul bâtiment).

---

### 1.5 La Route des marchés

**Pitch.** Au bout de la route, il y a d'autres villages. Avec la charrette de Joseph (puis une camionnette), vous partez chaque saison faire **la tournée des marchés** de la vallée : le bourg qui aime les fromages, le village de montagne qui manque de légumes, la ville qui paie cher le rare. Au fil des années, votre nom compte sur chaque marché et la carte de la vallée se dessine.

**Mécanique (téléphone).**
- **Une carte de la vallée** (feuille haute, illustrée, verticale) : 6 à 8 villages, dévoilés un par un (rang 2 → Domaine).
- **La tournée** : une fois par saison, charger une **caisse de tournée** (6 à 12 cases) depuis le grenier, choisir l'itinéraire (2 à 3 villages), et partir : la charrette quitte la ferme sur l'écran et revient 2 à 3 jours plus tard avec le résultat, des **nouvelles** et des **trouvailles** (variété ancienne, animal de race locale, recette, outil ancien).
- Chaque village a **ses goûts**, qui changent légèrement chaque année (« cette année, Saint-Aubin raffole des fraises »), et une **amitié** (comme Joseph) qui débloque son produit-cadeau et son jour de foire.
- **Session type** : remplir la caisse (glisser), choisir le chemin, voir revenir la charrette.

**Sens de l'argent / fin de partie.** Moyens de transport (charrette → camionnette → camion frigorifique), étals sur chaque marché, une boutique en ville. Fin : être « reçu » dans chaque village (bannière), la Grande Foire de la vallée.

**Variété et surprise.** Les goûts tournants, les trouvailles au retour, les nouvelles des villages (petit feuilleton). La production a de nouveaux débouchés qui ne sont pas « vendre au cours ».

**Sur la carte.** La route du bas mène quelque part : panneaux indicateurs, charrette qui part et revient, souvenirs des villages en décor. La transformation se voit surtout sur la carte de la vallée, pas sur la ferme.

**Liens avec l'existant.** Grenier, vendeur (les tournées), cheval (traction), commandes C1/C3, marchand ambulant C7, Joseph (sa charrette ♥10), album.

**Originalité.** Ressemble au bateau et au camion de Hay Day et aux expéditions de Family Island ; l'angle « tournée des marchés de campagne avec villages vivants » est plus français, mais l'originalité reste moyenne.

**Effort : M à L.**
**Risques.** Le cœur du jeu (la ferme) passe hors de l'écran ; doublon avec C1/C3 ; durée d'absence de la charrette à rendre douce (jamais de perte).

---

### 1.6 La Coopérative de la vallée

**Pitch.** Joseph n'est pas le seul voisin : sur les côtés de votre ferme, d'autres fermes peinent. Vous **fondez une coopérative** avec elles : on partage les machines, on mutualise les ventes, on s'entraide. À mesure que vous aidez chaque voisin, **sa ferme se transforme sous vos yeux**, au bord de la carte, et la coopérative grandit jusqu'à la grande fête des moissons commune.

**Mécanique (téléphone).**
- 4 à 5 **fermes voisines** visibles en bordure de la carte 2D (au-delà de la grille), chacune avec un personnage, une spécialité et un **besoin** (la ferme laitière de Lucie manque de foin, le maraîcher Ahmed a perdu ses serres, la jeune Inès commence et n'a rien).
- **Aider** : donner des graines, prêter un employé une saison, envoyer une machine en prêt, fournir une partie de la production, financer un chantier. Chaque aide fait progresser la ferme voisine (étapes visibles : clôture réparée, serre reconstruite, troupeau qui grandit).
- En retour, chaque voisin devient un **partenaire** : il achète vos surplus à bon prix, vous vend sa spécialité, envoie un coup de main pendant la récolte, et ouvre un **service coopératif** (moulin commun, laiterie commune, coopérative d'achat : graines −10 %).
- **Session type** : regarder où en sont les voisins, envoyer une aide (feuille « Coopérative »), recevoir un coup de main.

**Sens de l'argent / fin de partie.** Les chantiers des voisins sont un puits d'argent **généreux** (on paie pour les autres) ; bâtiments coopératifs (silo commun, salle des fêtes, coopérative de vente). Fin : 5 fermes prospères, « Coopérative de la vallée » avec son logo et sa fête.

**Variété et surprise.** Chaque voisin a un arc en plusieurs chapitres (petite histoire), des demandes qui changent, des événements (naissance d'un veau chez Lucie, mariage). Rend le jeu social sans multijoueur.

**Sur la carte.** Les fermes voisines changent : de délabrées à florissantes (bordure de carte vivante), chemins qui relient les fermes, machines prêtées qui partent chez le voisin.

**Liens avec l'existant.** Joseph (le doyen et premier membre), employés (prêt), machines (prêt), grenier, quêtes (Joseph devient une forme de quête parmi d'autres), D5 « quelques voisins ».

**Originalité.** **Attention** : c'est la plus proche de la restauration de village de Stardew (aider la communauté, voir des lieux se réparer). Différences réelles : ce sont des **fermes** (pas des bâtiments publics), on aide des **gens** avec des **ressources de gestion** (employés, machines), pas des paniers d'objets. Reste à risque vis-à-vis du souhait du propriétaire.

**Effort : L.** Personnages, états des fermes voisines, système d'aide, nouvelles feuilles.
**Risques.** Trop proche de D2 dans l'esprit ; multiplication des personnages à écrire ; art des fermes voisines.

---

### 1.7 Le Terroir des Tilleuls (labels et produit signature)

**Pitch.** Votre sol, votre météo et vos façons de faire donnent à vos produits un goût unique. Année après année, vous **affinez un produit signature** (un fromage, un cidre, un miel, une confiture), lui donnez un nom, une étiquette, et visez la reconnaissance : d'abord « Produit de la ferme », puis « Label des Tilleuls », jusqu'à l'**appellation** qui porte le nom de votre vallée.

**Mécanique (téléphone).**
- **Le terroir de chaque terrain** : 2 ou 3 caractéristiques fixes révélées au défrichage (argileux, ensoleillé, près du ruisseau, calcaire…) qui donnent une **note de goût** aux cultures qui y poussent (affichée en petites icônes).
- **Le produit signature** : on choisit **un** produit d'atelier et on le travaille sur plusieurs années : recette (ingrédients de quels terrains, de quelles variétés, de quels animaux), **affinage** (cave, temps), étiquette (nom choisi, couleur, dessin parmi des modèles).
- **Le cahier des charges** : pour monter d'un label, tenir des engagements **sur une année entière** (« 100 % de lait de vos chèvres nourries au pré », « pommes du verger du ruisseau seulement », « pas de machine sur le verger ») : des contraintes **choisies**, comme les niveaux du mode Niveaux, mais en carrière.
- **Dégustations** : au comice et à la foire, un jury goûte (résultat expliqué par critères, jamais d'échec : on progresse de palier en palier).
- **Session type** : vérifier l'affinage, ajuster un ingrédient, préparer la dégustation.

**Sens de l'argent / fin de partie.** Cave d'affinage, caveau de vente, salle de dégustation, étiquettes et emballages, deuxième et troisième produit signature. Fin : l'appellation (« AOC Vallée des Tilleuls ») et une **fête de l'appellation** ajoutée au calendrier.

**Variété et surprise.** Le goût dépend de la météo de l'année (« millésime ») : une année de canicule donne un miel exceptionnel ; une variété ancienne change la recette. Les contraintes du cahier des charges renouvellent le jeu chaque année.

**Sur la carte.** Cave voûtée, panneau « Appellation » à l'entrée, étiquettes sur l'étal, tonneaux, et une **bannière** sur chaque terrain qui entre dans l'appellation.

**Liens avec l'existant.** Ateliers niveau 5, animaux, verger, ruches, comice (dégustation), étal/marché fermier (vente premium), qualité (B2), grenier, contraintes à la façon des niveaux.

**Originalité.** Aucun jeu cosy ne fait du **terroir et du millésime** un objectif : Stardew a des fûts et des qualités, pas de lien sol-produit ni d'appellation. Très ancré dans la culture française.

**Effort : M à L.**
**Risques.** Abstraction (le « goût » est invisible : bien le traduire en icônes et en phrases du jury) ; transformation de la carte modérée ; risque de micro-gestion des recettes.

---

### 1.8 Le Livre de la ferme

**Pitch.** Un grand livre relié est posé sur la table de la cuisine. Chaque moment marquant de votre carrière y devient une **page illustrée en pixel art** : la première récolte, le jour où le tracteur est arrivé, l'hiver de la grande neige, la naissance du veau, la victoire au comice. Le livre n'est pas une liste : c'est un récit qui s'écrit tout seul, et dont certains chapitres sont des **souvenirs à provoquer**.

**Mécanique (téléphone).**
- **Souvenirs automatiques** (« moments ») : le jeu détecte des événements remarquables (record, première fois, météo rare, fête, visite rare) et compose une page (vignette = capture recadrée de la scène + texte court écrit à la première personne + date de jeu).
- **Souvenirs à provoquer** : une liste de silhouettes (« Un pique-nique sous le pommier en fleurs », « Les quatre saisons du même champ », « Une nuit d'orage avec toutes les bêtes rentrées », « Une citrouille géante le jour d'Halloween ») : petits défis poétiques, sans délai, qui demandent de **jouer autrement**.
- **Chapitres** : un par année, avec une page de titre que le joueur nomme (« L'année des abeilles ») ; au bout de N souvenirs dans un chapitre, une récompense (objet de décor qui rappelle ce souvenir).
- **Session type** : rien d'obligatoire ; on feuillette ; on vise un souvenir.

**Sens de l'argent / fin de partie.** Faible directement (souvenirs qui demandent d'acheter : « fêter les 10 ans avec un feu d'artifice »). Sert surtout de **colonne vertébrale émotionnelle** et d'écran d'accueil (« Où en étais-je ? » E6).

**Variété et surprise.** Les souvenirs à provoquer incitent à faire des choses inutiles et belles.

**Sur la carte.** Peu (le livre est une feuille) ; les objets-souvenirs posés en décor.

**Liens avec l'existant.** Album D1 (le livre en est la version narrative), bilan annuel, succès, événements rares (B4, B5), captures du canevas.

**Originalité.** Cozy Grove et Unpacking racontent par les objets ; Animal Crossing a un appareil photo. Un **journal de bord qui transforme ta partie en livre illustré** est original et très « téléphone » (partage d'une page en image).

**Effort : M.** Rendu des vignettes depuis le canevas, gabarits de texte.
**Risques.** Pas assez de « projet » à lui seul (c'est un support, pas un but) ; textes générés qui se répètent.

---

### 1.9 La Ferme-école

**Pitch.** L'école du village n'a plus de jardin. Vous ouvrez la ferme aux enfants : visites, ateliers, un petit potager pédagogique. Les années passent, les enfants grandissent, et certains reviennent — comme employés, comme voisins, comme repreneurs d'une ferme de la vallée. Votre héritage, ce sont des gens.

**Mécanique (téléphone).**
- Une **classe** visite la ferme **une fois par saison** (jour fixé à l'avance, annoncé dans l'agenda) : on choisit un **atelier** parmi ceux que la ferme permet (traire la chèvre, semer, ramasser les œufs, presser des pommes, reconnaître les oiseaux) ; les enfants suivent le fermier sur la carte (petite procession), et le joueur fait le geste avec eux (2 à 3 gestes au doigt).
- Chaque enfant a un **prénom et une graine d'intérêt** (animaux, machines, plantes, cuisine) qui grandit selon les ateliers qu'il a vus.
- **Ils grandissent** : un enfant vu en année 2 a 18 ans en année 8 → candidat à l'embauche (talent lié à ses ateliers), ou reprend une friche voisine, ou ouvre une boutique au bourg.
- **Le potager de l'école** : un petit terrain où les enfants plantent ce qu'ils veulent (surprise).
- **Session type** : la visite est un petit moment rituel par saison ; le reste du temps, rien.

**Sens de l'argent / fin de partie.** Salle de classe à la ferme, bus, matériel, mini-ferme pédagogique, colonie de vacances d'été. Fin : une génération d'anciens élèves dans la vallée.

**Variété et surprise.** Ateliers différents, enfants aux réactions drôles, retours imprévus des anciens élèves des années plus tard.

**Sur la carte.** Procession d'enfants, potager aux couleurs vives, salle de classe, dessins d'enfants accrochés à la clôture.

**Liens avec l'existant.** Employés (vivier d'embauche), animaux, ateliers, verger, Joseph (ancien instituteur ?), lanternes (critère « voisinage »), saga familiale (vos enfants sont dans la classe).

**Originalité.** Aucun jeu de ferme ne fait de la **transmission aux enfants** un but ; le lien « enfants d'aujourd'hui = employés de demain » est neuf.

**Effort : M à L.**
**Risques.** Beaucoup de personnages ; procession d'enfants à animer ; peu de puits d'argent.

---

### 1.10 La Grande Fête de la vallée

**Pitch.** La petite fête des récoltes, c'est vous qui l'organisez maintenant. Chaque année, vous l'agrandissez : un stand, puis une buvette, un manège, un bal, un feu d'artifice, des invités de toute la région. Le jour J, la ferme devient un champ de foire grouillant de monde, et tout le monde est venu pour **votre** fête.

**Mécanique (téléphone).**
- Un **terrain de fête** (pré dédié) avec des emplacements d'attractions (stands, chapiteau, manège, piste de bal, scène, buvette, concours de citrouilles géantes, feu d'artifice).
- **Avant la fête** (une saison) : choisir le **thème de l'année** (moisson, pommes, lumières, animaux), fournir les stands en produits (buvette = jus et cidre, stand = confitures), inviter des invités (Joseph, voisins, village de la Route des marchés).
- **Le jour J** : la carte se remplit de visiteurs ; le joueur fait 3 à 4 petites animations sans chrono ni échec (remettre le ruban, ouvrir le bal, lancer le feu d'artifice) ; recettes et **affluence** affichées en fin de journée.
- **L'affluence** grandit d'année en année selon la variété des attractions et des produits ; elle débloque de nouvelles attractions et de nouveaux invités.

**Sens de l'argent / fin de partie.** Attractions (chaque une 500 → 20 000), décor de fête, feu d'artifice (puits d'argent spectaculaire). Fin : la fête devient « régionale », puis l'« incontournable de l'automne ».

**Variété et surprise.** Thème différent chaque année, invités surprises, petits incidents drôles (le cochon qui s'échappe pendant le bal).

**Sur la carte.** Très fort **un jour par an** (foule, lampions, manège) ; le reste de l'année, le terrain de fête est calme (stands repliés).

**Liens avec l'existant.** Fêtes (C6), comice, ateliers, animaux, chambre d'hôte (les invités dorment), musique de festival.

**Originalité.** Les fêtes de Stardew sont organisées par le village ; ici le joueur **construit l'événement**. Originalité moyenne à bonne.

**Effort : L.**
**Risques.** Payoff concentré sur un seul jour ; animation de foule coûteuse ; peut doublonner avec C6.

---

### 1.11 L'Almanach (le savoir du temps)

**Pitch.** « Noël au balcon, Pâques au tison. » Joseph connaît des dizaines de dictons, et ils sont souvent vrais. Vous les recueillez, les vérifiez saison après saison, et construisez peu à peu votre **almanach**, jusqu'à lire la météo dans le vol des hirondelles et à anticiper le gel avant tout le monde.

**Mécanique (téléphone).**
- **Dictons** à découvrir (par Joseph, les visiteurs, la Route des marchés) : chacun relie un **signe** (« les hirondelles volent bas », « la lune rousse », « rosée du matin ») à une **météo future** (pluie demain, gel tardif, été chaud).
- **Vérifier** : observer le signe (il apparaît dans la scène : toucher les hirondelles), puis constater la météo ; au bout de 3 vérifications, le dicton est « confirmé » et **sa prévision s'affiche** désormais dans la barre du haut.
- Le moteur météo existant est **déterministe par flux** : les signes sont tirés de la **copie du flux** (comme l'almanach actuel), donc vrais, sans changer la météo.
- Station météo, baromètre, girouette : bâtiments qui confirment plus vite.

**Sens de l'argent / fin de partie.** Faible (instruments). Plutôt un **système de maîtrise** qu'un grand projet.

**Variété et surprise.** Les signes dans la scène sont de jolis petits moments ; l'hiver devient intéressant (dictons d'hiver).

**Sur la carte.** Hirondelles, girouette, station météo, ciel lu.

**Liens avec l'existant.** Météo et son almanach (déjà une copie du flux), Joseph, gel, canicule.

**Originalité.** Totale (personne ne fait des dictons un système) ; très française. Mais **trop petit** pour être *le* grand projet : excellent module complémentaire.

**Effort : S à M.**
**Risques.** Petite portée ; dictons à écrire avec soin (vrais dictons du domaine public).

---

## 2. Tableau comparatif

Notes de 1 (faible) à 5 (fort).

| Concept | Sens de l'argent | Joueur au centre | Variété / surprise | Carte transformée | Lien à l'existant | Originalité | Effort |
|---|---|---|---|---|---|---|---|
| 1.1 Grainothèque vivante | 3 | **5** (croiser exige la main) | **5** | 3 | 5 | 4 | L |
| 1.2 Vallée qui revient | **5** | 4 | 4 | **5** | 5 | **5** | L-XL |
| 1.3 Saga des Tilleuls | 3 | 3 | 4 | 3 | 4 | **5** | M-L |
| 1.4 Table des Tilleuls | 4 | 3 | 3 | 2 | 4 | 2 | M |
| 1.5 Route des marchés | 3 | 3 | 4 | 2 | 4 | 2 | M-L |
| 1.6 Coopérative | 4 | 3 | 3 | 4 | 4 | 2 (proche de D2) | L |
| 1.7 Terroir et labels | 4 | 4 | 4 | 3 | 4 | **5** | M-L |
| 1.8 Livre de la ferme | 1 | 3 | 3 | 1 | 4 | 4 | M |
| 1.9 Ferme-école | 2 | 3 | 3 | 3 | 3 | 4 | M-L |
| 1.10 Grande Fête | 4 | 3 | 4 | 3 (un jour/an) | 4 | 3 | L |
| 1.11 Almanach | 1 | 3 | 3 | 2 | 4 | **5** | S-M |

---

## 3. Recommandation : les 3 meilleurs

### 1er — La Vallée qui revient (1.2)

- C'est la seule idée qui **transforme toute la carte**, y compris ce qui n'appartient pas au joueur (lisière, ruisseau, ciel) : le payoff visuel le plus fort, idéal en portrait où l'on fait défiler la ferme.
- Elle répond **exactement** au diagnostic : « la ferme se joue toute seule » → la nature ne s'automatise pas ; elle crée même une tension douce et choisie entre rendement (machines, monoculture) et vie (haies, jachères). « L'argent n'a plus de sens » → il achète de la vie et du paysage, un puits d'argent qu'on aime remplir.
- Ton parfaitement cosy (rien ne repart jamais, découvertes à l'aube), thème actuel et sincère (agroécologie), et **aucun jeu du genre** ne le fait.
- Elle utilise des choses déjà prévues (mare et canards, verger, ruches, pêche, corbeaux, carte 2D, album).

### 2e — La Grainothèque vivante (1.1)

- Elle soigne le problème n° 1 (routine identique, une culture domine) **au cœur de l'action la plus fréquente** : semer et récolter. Chaque sachet croisé est une surprise.
- Elle **garde le toucher utile** même avec 8 employés et toutes les machines : seul un croisement récolté à la main crée une variété (F1).
- Elle donne une collection longue (≈ 40 variétés, légendaires en 3 générations) qui continue après le Domaine.

### 3e — La Saga des Tilleuls (1.3)

- La plus **émotionnelle** et la plus neuve dans le genre : la carrière devient l'histoire d'une famille.
- Elle résout le jeu libre vide après le Domaine sans prestige punitif : chaque génération (talent + vœu) **relance un style de jeu** différent, avec une ferme intacte.
- Effort raisonnable (logique légère, art concentré sur portraits et vitrine).

*Mention spéciale* : **Terroir et labels (1.7)** est presque à égalité (très original, très français) ; il gagne à être greffé plus tard sur la Grainothèque (variétés + terroir = goût). **L'Almanach (1.11)** est un excellent petit module à faire de toute façon.

---

## 4. Proposition « signature » : **La Vallée vivante**

Combiner **La Vallée qui revient** et **La Grainothèque vivante** en un seul grand projet, raconté par le **Livre de la ferme** et rythmé par la **Saga** en option.

**L'histoire.** La vallée a perdu ses haies, ses bêtes et ses semences. Joseph garde une boîte de graines anciennes et des souvenirs de la vallée d'avant. Votre projet de toute une carrière : **faire revivre la vallée, plante par plante, bête par bête.**

**Pourquoi les deux s'emboîtent.**
- Les **variétés anciennes** et les **bandes fleuries** attirent les pollinisateurs ; les pollinisateurs **augmentent les chances de croisement** et la qualité ; les haies abritent les auxiliaires qui protègent les planches d'essai. → Une boucle vertueuse : la biodiversité cultivée (graines) et la biodiversité sauvage (faune) se nourrissent l'une l'autre, exactement comme dans la réalité.
- Certaines espèces sauvages ne viennent **que** pour une variété (« le sphinx colibri vient butiner la tomate ancienne "Cœur de bœuf des Tilleuls" ») ; certaines variétés **ne se trouvent que** dans la nature restaurée (une fraise des bois au bord du ruisseau revenu, un pommier sauvage dans la haie).
- Une seule nouvelle fiche dans le Carnet : **« La Vallée »**, deux pages (Graines · Faune) avec silhouettes grises, et toujours **le prochain indice** visible (E2 « À faire maintenant »).

**Arc sur la carrière (joueur tranquille).**

| Rang | Ce qui s'ouvre |
|---|---|
| 1 Petite ferme | Première haie offerte par Joseph ; 2 variétés anciennes dans la boîte ; premier oiseau (rouge-gorge). |
| 2 Ferme familiale | Croisements possibles ; bandes fleuries ; nichoirs ; Grainothèque niv. 1 ; 6 espèces sauvages. |
| 3 Belle ferme | Mares ; jachère dans le plan de culture ; échanges de graines avec les visiteurs ; ruisseau étape 1 (le filet d'eau revient). |
| 4 Grande ferme | Grainothèque niv. 3 ; variétés de 2e génération ; ruisseau étape 2 (truites, pêche améliorée) ; chouette. |
| 5 Exploitation modèle | Terres sauvages (acheter la lisière pour la rendre à la nature) ; observatoire ; héron, loutre. |
| 6 Domaine | Variétés légendaires (3e génération) ; ruisseau étape 4 (la rivière, le moulin à eau) ; cigognes sur le Manoir ; « Vallée vivante » au comice régional. |
| Après | Compléter Graines et Faune, visiteurs rarissimes, chapitres du Livre ; (option Saga) le prochain fermier hérite de la vallée et d'un objet de famille. |

**Ce que fait le joueur par session (5 à 10 min).** Regarder qui est venu ce matin · ouvrir un sachet croisé et choisir où le semer · récolter à la main la planche d'essai · poser une haie ou une mare avec l'argent de la saison · lire l'indice suivant. Les employés et les machines font la production ; le joueur fait **le vivant**.

**Garde-fous de conception.**
- Tout est **gardé par `state.mode === 'career'`** ; tirages (croisements, venues) sur un flux `career` dédié, aucun effet sur le mode Niveaux ni sur `tests/parity.test.js`.
- Logique en données pures (`src/data/career/valley.js` : espèces, recettes d'habitat, variétés, table de croisement), règles dans `src/core/career/valley.js`, testables sous Node ; simulation : un robot « tranquille » doit voir ≥ 1 nouveauté par saison.
- **Rien ne se perd jamais** : une espèce venue reste, une variété fixée reste, aucun effet négatif ; les recettes d'habitat se vérifient à l'aube.
- Pas de placement libre : emplacements prédéfinis (lisière, bout de champ, coin de pré), cibles ≥ 48 px.
- Lisibilité : 3 variétés visibles par culture au départ, traits en pictogrammes + mot (pas de couleur seule, A3), recettes affichées en clair dès le premier indice.

**Effort estimé : XL** si tout est fait d'un coup ; découpable en 3 lots :
1. **Lot Graines** (L) : variétés, traits, croisements, Grainothèque, recoloration de sprites.
2. **Lot Faune** (L) : aménagements nature, 15 premières espèces, recettes d'habitat, rendu de la lisière vivante.
3. **Lot Vallée** (L) : ruisseau en 4 étapes, terres sauvages, 15 espèces de plus, légendaires, liens croisés graines ↔ faune, chapitres du Livre.

**Risques principaux.** Volume d'art (≈ 30 animaux sauvages, ruisseau en autotuiles, états de végétation : à confier à l'agent graphique avec des ressources CC0 existantes en base) ; équilibre des traits de variétés (simulation) ; surcharge d'interface (une seule fiche, un indice à la fois).

**Pourquoi ce n'est pas Stardew.** Pas de paniers d'objets « une de chaque », pas de bâtiment public à réparer, pas de récompense par salle : l'objectif naît de **façons de cultiver** (sélection paysanne, haies, jachères) et se mesure en **vie revenue**, sur la ferme et autour. Le joueur ne rend pas un service au village : il fait de sa propre ferme un paysage vivant.
