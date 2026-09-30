# Game design — « Une année à la ferme »

Document de référence du gameplay. Les chiffres marqués *(équilibré)* ont été réglés avec la simulation (`tools/simulate.js`) ; la version qui fait foi vit dans `src/data/`, et ce document est mis à jour en conséquence.

> **Mode Carrière (conception 2026-09-30)** : une ferme à soi qui dure et grandit d'année en année — voir **§ 14** et `docs/CARRIERE.md`. Le mode Niveaux décrit ici ne change pas.
>
> **Deux modes de difficulté (2026-09-30)** : les chiffres des § 3 à § 12 sont ceux du mode **classique**. Les nouvelles parties se jouent par défaut en mode **détente** (charges, fermages, départ, prix des récoltes, pousse sans arrosage et prêt du voisin) : voir **§ 13**.

## 1. Intention

- Jeu de gestion **relaxant** : pas de réflexes, pas de combat, pas de punition brutale.
- Une partie = **une année** (4 saisons), environ **10 à 12 minutes** en vitesse normale.
- Le plaisir vient de l'**arbitrage** : dépenser pour replanter (gain rapide) ou investir dans du **revenu quotidien automatique** (gain lent mais régulier), en préparant l'**hiver** où presque rien ne pousse.
- Contrôle **100 % souris** (raccourcis clavier en bonus).

## 2. Le temps

- 1 jour = **20 secondes** en vitesse ×1. Vitesses : pause, ×1, ×2, ×4.
- 1 saison = **7 jours** (modifiable par niveau), 1 année = 4 saisons : printemps → été → automne → hiver.
- Chaque jour commence à l'**aube** : c'est là que tombent les revenus automatiques, les charges quotidiennes et la nouvelle météo.
- Ordre exact de l'aube : (1) pousse des cultures d'après l'arrosage et la météo de la veille, puis remise à zéro de l'arrosage ; (2) nouveau jour — début de saison, et gel au 1er jour d'hiver ; (3) nouvelle météo ; (4) maladie (jour de pluie, niveau 3) ; (5) la pluie arrose tout ; (6) nouveau cours du marché (niveau 6) ; (7) arrosage automatique ; (8) revenus des investissements ; (9) charges quotidiennes ; (10) mensualité du prêt (niveau 7).
- Le **fermage** se paie le soir du dernier jour de la saison, avant l'aube suivante.
- La lumière de la scène suit le jour (aube rosée, midi clair, soir orangé), sans nuit noire.

## 3. Le potager

### 3.1 Parcelles
- Le champ est une grille de parcelles. Niveau 1 : **12 parcelles ouvertes** (4 × 3, centrées en haut) sur une grille de **24** (6 × 4) ; les autres s'achètent (prix croissant : **40, 50, 60…**, soit 40 + 10 × parcelles déjà achetées).
- Clic sur une parcelle :
  - vide → choix d'une graine (liste des cultures plantables cette saison, avec prix, durée, gain) ;
  - plantée, pas encore arrosée aujourd'hui → **arrosage** ;
  - mûre → **récolte** : l'argent est gagné immédiatement (+ petite animation de pièces).
- Survol : infobulle (culture, jours restants, arrosée ou non).

### 3.2 Pousse et arrosage
- Chaque culture a une **durée de pousse** en jours et **5 étapes visuelles** (graine, pousse, jeune plant, plant, mûr).
- Chaque aube, une parcelle plantée progresse de **1 jour si elle a été arrosée la veille**, sinon de **0,5 jour**.
- La **pluie** (et l'orage) arrose tout le champ automatiquement ; une graine semée un jour de pluie est arrosée d'office. La **canicule** : une parcelle non arrosée ne pousse pas du tout ce jour-là.
- L'arrosage vaut pour la journée : il est remis à zéro à chaque aube, juste après la pousse.
- Étapes visuelles : 0 = vient d'être semée, 1 à 3 selon l'avancement (quarts de la durée), 4 = mûre.
- L'arrosage est aussi automatisable (investissement *Arrosage automatique*).
- Une culture mûre reste récoltable indéfiniment, sauf en cas de gel (ci-dessous).

### 3.3 Saisons des cultures
- Chaque culture a ses saisons de plantation. Une culture déjà plantée continue de pousser au changement de saison, **sauf à l'arrivée de l'hiver** : les cultures non « hiver » **gèlent** au 1er jour d'hiver (parcelle vidée, message clair).
- Un **avertissement** s'affiche 2 jours avant chaque changement de saison (et 2 jours avant le gel).

### 3.4 Cultures (graphismes Kenney Tiny Farm) *(équilibré)*

| Culture | Saisons | Durée | Graine | Vente | Résiste au gel |
|---|---|---|---|---|---|
| Carotte | printemps, automne | 2 j | 4 | 10 | non |
| Navet | printemps, automne, hiver | 3 j | 6 | 14 | oui |
| Blé | printemps, été | 4 j | 5 | 16 | non |
| Chou | automne, hiver | 4 j | 8 | 20 | oui |
| Tomate | été | 5 j | 12 | 38 | non |
| Maïs | été, automne | 6 j | 15 | 50 | non |
| Tournesol | été | 5 j | 10 | 32 | non |

Les cultures d'hiver (navet, chou) rapportent peu : l'hiver se prépare avec les réserves d'automne et les revenus des investissements.

(La liste exacte dépend des sprites disponibles dans le pack ; toute culture ajoutée suit le même format.)

## 4. Les investissements (revenu automatique quotidien)

Chaque investissement s'achète une fois ou plusieurs (quantité max), apparaît physiquement dans la scène (bâtiment, animaux qui se promènent) et rapporte **chaque aube**. Certains ont un **entretien quotidien** ou un effet spécial. *(équilibré)* Les prix des unités successives sont donnés dans l'ordre d'achat. Un investissement se rembourse en 9 à 15 jours environ : acheté tôt, il rapporte gros ; acheté en fin d'automne, il ne se rembourse plus avant la fin de l'année.

| Investissement | Prix | Revenu | Entretien/jour | Max | Particularité |
|---|---|---|---|---|---|
| Poulailler (poules) | 70 / 85 / 100 | +7/jour | 1 | 3 | Revenu régulier toute l'année |
| Ruche | 60 / 80 / 100 | +5/jour (0 en hiver) | 0 | 3 | Chaque ruche : cultures +10 % de vitesse de pousse (hors hiver) |
| Étal au bord de la route | 180 | +4/jour (+8 en été, +2 en hiver ; 0 les jours d'orage) | 0 | 1 | Récoltes vendues **+20 %** |
| Vache | 180 (étable comprise) / 140 / 140 | +16/jour | 3 | 3 | La 1ʳᵉ vache vient avec l'étable |
| Moutons | 120 / 140 / 160 | 0/jour | 2 | 3 | **Tonte** : +90 par mouton à l'aube du dernier jour du printemps, de l'été et de l'automne (juste avant le fermage) |
| Arrosage automatique | 120 / 200 / 320 | — | 1 (forfait) | 3 niveaux | Arrose 8 / 16 / toutes les parcelles plantées (non mûres) chaque matin |
| Panneau solaire | 80 / 100 | −5 de charges/jour | 0 | 2 | Réduit les charges fixes (jamais en dessous de 0) |
| Chambre d'hôte | 300 | +34 été, +20 printemps/automne, +8 hiver | 2 | 1 | Gros revenu saisonnier |

L'arrosage automatique ne rapporte rien en soi : il épargne les clics (et au niveau 2, chaque arrosage automatique coûte aussi 1 pièce).

Revente : impossible (on assume ses choix — cohérent avec l'arbitrage).

## 5. Les charges et la faillite

- **Charges quotidiennes** : entretien de la ferme (**5/jour**) + entretien des investissements − panneaux solaires (minimum 0).
- **Fermage de fin de saison** : payé automatiquement le dernier soir de chaque saison. Niveau 1 : **60 / 120 / 170 / 240** (printemps → hiver) ; les autres niveaux au § 8.
- L'argent peut devenir **négatif** à cause des charges quotidiennes, de l'arrosage automatique payant ou du prêt (petite dette tolérée, affichée en rouge), mais **si, au moment du fermage, l'argent est insuffisant, c'est la faillite** : écran de fin, bilan, recommencer. Les achats (graines, parcelles, investissements) exigent d'avoir la somme. *(Mode détente : Joseph, le voisin, avance d'abord ce qui manque, § 13.5.)*
- Un **indicateur de prévision** montre en permanence : prochain fermage, jours restants, revenu quotidien net estimé.

## 6. Victoire et étoiles

- Survivre au **fermage d'hiver** = année réussie → écran de victoire (musique de festival), bilan de l'année.
- Étoiles selon l'argent final *(équilibré, par niveau, voir § 8)* : ★ année terminée, ★★ ≥ seuil 2, ★★★ ≥ seuil 3. Le seuil ★★★ correspond au meilleur joueur-robot de la simulation : il demande de ne jamais laisser une parcelle vide et de bien choisir ses achats.
- Les étoiles sont sauvegardées ; finir un niveau débloque le suivant.

## 7. Météo

- Tirée chaque aube selon une table par saison (et par niveau). Prévision du lendemain affichée.
- Types : **ensoleillé**, **nuageux**, **pluie** (arrose tout), **orage** (arrose tout, pas de revenu de l'étal ce jour-là), **canicule** (été), **neige** (hiver, purement visuel + ambiance).
- Effets visuels : particules de pluie, flocons, lumière chaude en canicule ; ambiances sonores associées.

## 8. Les niveaux (une année = une contrainte)

| # | Nom | Contrainte principale | Mécanique moteur |
|---|---|---|---|
| 1 | Première année | Tutoriel guidé, climat doux, fermage bas | Tutoriel pas à pas |
| 2 | L'année de sécheresse | Pluie très rare, canicules fréquentes ; arroser coûte 1 pièce par parcelle (l'arrosage automatique aussi) | Table météo + coût d'arrosage |
| 3 | L'année pluvieuse | Pluie fréquente ; **maladie** : chaque jour de pluie, 5 % de chance qu'une culture non récoltée pourrisse | Probabilité de maladie |
| 4 | Le petit lopin | Seulement 6 parcelles, pas d'extension ; il faut miser sur les animaux | Nombre de parcelles |
| 5 | L'hiver sans fin | L'hiver dure 14 jours, fermage d'hiver plus élevé | Durée des saisons |
| 6 | Le marché fou | Le prix de vente de chaque culture varie chaque jour (×0,5 à ×1,8), affiché ; le cours revient vite vers 1, donc attendre un jour quand il est bas peut payer | Volatilité des prix |
| 7 | Le crédit | Départ avec 600 pièces, mais une mensualité de 150 pièces tous les 7 jours (jours 4, 11, 18 et 25 : le prêt est remboursé en entier) en plus du fermage | Prêt |
| 8 | L'année bio | Pas d'arrosage automatique ; replanter la même culture sur une parcelle réduit son rendement de 30 % (rotation) | Fatigue du sol |

Chaque niveau définit aussi : argent de départ, parcelles ouvertes, fermages, seuils d'étoiles, investissements disponibles. *(équilibré)*

*(v3)* Niveaux 9 à 12 (atelier de confitures, verger, montagne, concours du village) : voir § 12.6.

| # | Départ | Parcelles (ouvertes / max) | Saisons (jours) | Fermages (printemps → hiver) | ★★ / ★★★ | Réglages |
|---|---|---|---|---|---|---|
| 1 | 100 | 12 / 24 | 7-7-7-7 | 60 / 120 / 170 / 240 | 500 / 900 | Pas de vache ni de chambre d'hôte ; tutoriel |
| 2 | 120 | 12 / 24 | 7-7-7-7 | 60 / 110 / 150 / 220 | 250 / 430 | Arrosage : 1 pièce ; canicules fréquentes, pluie rare |
| 3 | 100 | 12 / 24 | 7-7-7-7 | 70 / 90 / 190 / 300 | 280 / 480 | Maladie : 5 % par culture et par aube pluvieuse |
| 4 | 200 | 6 / 6 | 7-7-7-7 | 60 / 110 / 160 / 220 | 220 / 370 | Champ de 3 × 2, sans extension |
| 5 | 100 | 12 / 24 | 7-7-7-14 | 80 / 150 / 250 / 900 | 160 / 260 | Hiver de 14 jours |
| 6 | 100 | 12 / 24 | 7-7-7-7 | 70 / 130 / 230 / 540 | 280 / 500 | Cours ×0,5 à ×1,8, nouveau chaque aube |
| 7 | 600 | 12 / 24 | 7-7-7-7 | 150 / 300 / 420 / 650 | 300 / 520 | Prêt : 150 aux jours 4, 11, 18, 25 |
| 8 | 100 | 12 / 24 | 7-7-7-7 | 80 / 160 / 240 / 440 | 180 / 295 | Pas d'arrosage automatique ; replanter la même culture : récolte −30 % |

Résultats de la simulation (200 parties par niveau et par stratégie, voir `tools/simulate.js`) : le niveau 1 est gagné par tous les robots (le joueur insouciant finit avec ~140 pièces, une étoile) ; à partir du niveau 2, le joueur insouciant (graines les moins chères, aucun investissement) fait faillite dans 70 à 100 % des parties, le plus souvent en hiver ; les stratégies réfléchies gagnent 89 à 100 % des parties, avec une marge qui se réduit au fil des niveaux.

## 9. Interface

Pensée d'abord pour le **téléphone tenu en portrait** (cahier des charges : `docs/MOBILE.md`).

- **Barre du haut** (2 lignes) : argent et saison (jour X/7), météo du jour → demain, prochain fermage (montant, jours restants, couleur vert / orange / rouge), un gros bouton de vitesse (×1 → ×2 → ×4 → pause ; appui long : pause). Toucher une case ouvre sa fiche détaillée.
- **Onglets en bas** : *Ferme* (ferme les feuilles, recentre le champ), *Acheter* (cartes d'investissement avec prix, revenu par saison, entretien, quantité possédée ; raison écrite si l'achat est impossible), *Bilan* (solde quotidien, fermages de l'année, prêt, marché, bilan de l'année, objectifs), *Menu* (pause, options, recommencer, quitter).
- **Scène** (canvas pixel art, zoom entier) : parcelles de 2 × 2 tuiles, bâtiments, animaux, décor saisonnier ; défilement vertical au doigt si le monde dépasse l'écran.
- **Au doigt** : toucher une parcelle agit tout de suite (semer → choix des graines, arroser, récolter, ouvrir) ; toucher une parcelle déjà arrosée ou faire un appui long → sa fiche ; glisser sur le champ → arroser ou récolter en série ; toucher un bâtiment → sa fiche (achat possible).
- **Choix des graines** : feuille du bas, grandes lignes (durée, prix de la graine, prix de vente, gain par jour, avertissements gel / sol fatigué / cours), une touche pour semer, option « Semer partout ».
- **Fenêtres** : menu principal, sélection du niveau (avec étoiles), options (volumes, vibration, écran allumé, animations réduites, plein écran, installer le jeu), crédits, pause, fin de saison (résumé), victoire, faillite.
- **Textes flottants** : « +12 » au-dessus des récoltes et des bâtiments à l'aube.
- **Tutoriel** (niveau 1) : bulles courtes placées en haut ou en bas de l'écran sans cacher la cible — planter, arroser, accélérer, récolter, comprendre le fermage, acheter un poulailler, préparer l'hiver.
- **Ordinateur** : même interface, onglets dans la barre du haut, feuilles à droite ; raccourcis Espace = pause, 1/2/3 = vitesses, B = acheter, N = bilan, F = ferme, M = son, Échap = menu.

## 10. Audio

- Musique par saison (Sirental) avec fondu enchaîné au changement de saison, thème du village au menu, festival à la victoire.
- Ambiances : oiseaux (printemps/été), vent (hiver), pluie selon la météo.
- Sons : clic, plantation, arrosage, récolte (pièces), achat, coq à l'aube, cris d'animaux ponctuels, jingle de fin de saison, victoire, faillite.
- Volumes réglables et mémorisés ; l'audio démarre après la première interaction (contrainte des navigateurs).

## 11. Sauvegarde

- Sauvegarde automatique (localStorage) à chaque aube et à la fermeture : partie en cours + progression (étoiles par niveau) + options.
- « Continuer » au menu si une partie est en cours.

---

# Contenu v3 (conception, 2026-09-30)

> **v3** — Tout ce qui suit est nouveau. Les chiffres marqués *(équilibré)* ont été réglés avec la simulation (`tools/simulate.js`, 2026-09-30) ; la version qui fait foi vit dans `src/data/`. Contrats de code : `docs/ARCHITECTURE.md`, section « v3 ».
>
> **Règle d'or : les niveaux 1 à 8 ne changent pas.** Leurs chiffres (départ, fermages, météo, seuils, cultures et investissements proposés) restent ceux du § 8. Sans bonus permanent, une partie des niveaux 1 à 8 doit se dérouler **exactement** comme en v2 (même graine → même météo, mêmes résultats : test de parité, § 12.11). Les nouveautés (cultures, ateliers, chèvres) n'y apparaissent que par un bonus permanent explicite (« Semencier », § 12.4) ; les nouveaux niveaux 9 à 12 sont construits autour d'elles.

## 12. Vue d'ensemble v3

Cinq ajouts, choisis par l'utilisateur :

1. **Nouvelles cultures** : pomme de terre, fraise, courgette, citrouille, et le **pommier**, un arbre qui occupe une parcelle toute l'année (§ 12.1).
2. **Transformation** : atelier de confitures, fromagerie (avec les **chèvres**), moulin (farine puis pain). Un interrupteur par bâtiment, rien d'autre à gérer (§ 12.2, 12.3).
3. **Progression permanente** : les étoiles achètent des **bonus** entre les années ; **26 succès** (§ 12.4, 12.5).
4. **Niveaux 9 à 12** (§ 12.6).
5. **Personnalisation** purement décorative : décorations, allées, clôture, nom de la ferme, tenue du fermier, achetées en **écus** (§ 12.7).

Principes : chaque ajout se joue **au doigt, en portrait** sans nouvel écran compliqué ; aucune action répétitive nouvelle (les ateliers travaillent seuls) ; aucune punition brutale (un atelier plein n'empêche jamais de vendre) ; la personnalisation n'a **aucun** effet sur le jeu.

## 12.1 Nouvelles cultures *(v3)*

Données dans `src/data/crops.js`, **ajoutées après les 7 cultures existantes** (l'ordre des anciennes ne bouge pas). Graphismes : 5 étapes de pousse + icône + sachet de graines (dessinés dans le style Tiny Farm).

| Culture | id | Saisons | Durée | Graine | Vente | Gel | Particularité |
|---|---|---|---|---|---|---|---|
| Pomme de terre | `potato` | printemps, été, automne | 4 j | 5 | 16 | gèle | **Pousse sans arrosage** : non arrosée, elle avance quand même d'1 jour (0,5 les jours de canicule) |
| Fraise | `strawberry` | printemps, été | 4 j | 12 | 26 | gèle | Se transforme en **confiture** (atelier) |
| Courgette | `zucchini` | été | 3 j | 8 | 22 | gèle | Cycle court : idéale en fin d'été |
| Citrouille | `pumpkin` | été, automne | 7 j | 18 | 62 | gèle | Grosse récolte, longue : à semer tôt (concours du niveau 12) |

Repères (profit par jour et par parcelle, arrosée) : pomme de terre 2,75 (sans aucun clic d'arrosage), fraise 3,5, courgette 4,7, citrouille 6,3 — à comparer à carotte 3, tomate 5,2, maïs 5,8. Aucune n'écrase les anciennes : elles élargissent les choix.

Pomme de terre, règles exactes : nouveau champ de donnée `dryGrowth: 1` (pousse non arrosée) et `dryHeatwaveGrowth: 0.5` (pousse non arrosée un jour de canicule). L'arrosage ne lui sert donc que les jours de canicule : toucher une parcelle de pommes de terre n'arrose que si la canicule est annoncée aujourd'hui (sinon, fiche) ; l'arrosage automatique l'ignore aussi, sauf ces jours-là. Au niveau 2 (arrosage payant), c'est une économie réelle — mais elle n'y est disponible qu'avec le bonus « Semencier ». La feuille des graines l'annonce (« Pousse sans arrosage ») ; toucher la parcelle un jour sans canicule ouvre sa fiche (refus : « Pas besoin : elle pousse sans arrosage. »).

### Le pommier (`apple`)

Un **arbre fruitier** planté sur une parcelle, qui y reste jusqu'à la fin de l'année (ou jusqu'à ce qu'on l'arrache). Nouveau champ `kind: 'tree'` dans les données.

| Champ | Valeur | Sens |
|---|---|---|
| `seedCost` | **45** | prix du jeune plant |
| `seasons` | printemps, été, automne | saisons où l'on peut le planter (pas en hiver) |
| `growDays` | **6** | jours avant d'être adulte (étapes : jeune plant < 3 j, jeune arbre < 6 j, adulte) |
| `fruitDays` | **3** | jours pour qu'une récolte de pommes mûrisse sur un arbre adulte |
| `fruitSeasons` | été, automne | saisons où les fruits avancent |
| `sellPrice` | **26** | prix d'un panier de pommes (une récolte) |
| `frostHardy` | oui | **ne gèle jamais** |
| `needsWater` | non | ne s'arrose pas |

Règles exactes :

- **Croissance** : à chaque aube, si le jour écoulé était au printemps, en été ou en automne, l'arbre gagne 1 jour × (1 + bonus de pousse : ruches, « Main verte »), jusqu'à `growDays`. En hiver, rien ne pousse (**dormance**). L'arrosage, la pluie et la canicule n'ont aucun effet sur lui.
- **Fruits** : sur un arbre adulte, à chaque aube dont le jour écoulé était en été ou en automne, les fruits gagnent 1 jour × (1 + bonus de pousse). À `fruitDays`, les pommes sont mûres : la parcelle est récoltable. Récolter rapporte le prix du panier (× étal, × réputation…) et remet les fruits à 0 ; l'arbre reste.
- Des pommes mûres restent sur l'arbre indéfiniment (même en hiver : l'arbre ne gèle pas). Elles ne mûrissent pas « deux fois » : on ne gagne rien à attendre.
- **Maladie** (niveau pluvieux, ou tout niveau avec `rotChance`) : seules des pommes **mûres** peuvent pourrir (fruits remis à 0, l'arbre reste).
- **Fatigue du sol** : ne concerne pas les arbres. Arracher un arbre ne compte pas comme une récolte (`lastHarvested` remis à `null`).
- **Apparence** (rendu) : jeune plant, jeune arbre, adulte ; adulte selon la saison : **printemps en fleurs**, **été vert avec fruits** (pommes visibles seulement si mûres ou presque, étape de fruit), **automne feuilles orangées + fruits**, **hiver nu**.
- **Arracher** : toujours possible depuis la fiche de la parcelle (confirmation), gratuit, sans remboursement ; la parcelle redevient vide.
- « Semer partout » ne plante jamais d'arbre.

Repères : planté au 1er jour du printemps (saisons de 7 jours), il est adulte à l'aube du 7ᵉ jour et donne des pommes aux aubes des jours 11, 14, 17 et 20 : **4 paniers** (104 pièces, 176 en jus de pomme) pour 45 pièces, **sans un seul clic d'arrosage**. Planté en été : 2 paniers. Planté en automne : aucune récolte avant la fin de l'année — la feuille des graines l'écrit (« Aucune pomme avant la fin de l'année »).

### Disponibilité des nouvelles cultures

- Niveaux 1 à 8 : liste explicite des 7 cultures d'origine (`BASE_CROPS`), **inchangée**. Les 5 nouvelles (dont le pommier) s'y ajoutent seulement avec le bonus « Semencier » (champ de niveau `seedMerchant: true` ; les niveaux 9 à 12 ont leur propre liste et le bonus n'y change rien — la montagne reste sans courgette ni citrouille).
- Niveaux 9 à 12 : liste par niveau (§ 12.6).

## 12.2 Transformation *(v3)*

### Principe (une règle, un interrupteur)

Un **atelier** a des **places** (2 au niveau 1 du bâtiment, 3, puis 4). Tant que son **interrupteur « Transformer »** est allumé :

- **Ateliers à récoltes** (atelier de confitures, moulin) : quand on récolte une culture que l'atelier sait transformer et qu'**une place est libre**, la récolte part à l'atelier au lieu d'être vendue (texte flottant : icône du produit « → atelier », pas de pièces). **S'il n'y a pas de place libre, la récolte est vendue normalement** : jamais de file d'attente, jamais de perte, rien à gérer.
- **Fromagerie** (animaux) : à l'aube, le lait de chaque vache puis de chaque chèvre va, **une unité par place libre**, à la fromagerie au lieu d'être vendu ce jour-là (ce jour-là, l'animal concerné ne rapporte rien ; les autres paient normalement).
- Chaque place travaille un nombre de **jours** fixe (`days` = nombre d'aubes). À l'aube où il est prêt, le produit est **vendu tout seul** (revenu de l'aube « produits », texte flottant au-dessus du bâtiment) et la place se libère.
- Interrupteur éteint : plus rien n'entre ; ce qui est en cours continue et se vend normalement.
- **Vendre en l'état** (bouton de la fiche du bâtiment) : vend tout de suite tout ce qui est en cours **au prix de la matière première** (valeur « en l'état » fixée à l'entrée, voir plus bas). Utile avant un fermage.
- **Filets de sécurité** : (1) au moment d'un fermage, si l'argent manque et que des produits sont en cours, ils sont **vendus en l'état automatiquement** avant de décider de la faillite (événement `processingSoldRaw`, raison `rent`) ; (2) le soir du dernier jour de l'année, juste avant le fermage d'hiver, tout ce qui est en cours est vendu en l'état (raison `yearEnd`). Rien n'est jamais perdu.
- Un atelier acheté commence **allumé**.

Prix d'un produit à la vente : `round(valeur de la recette × (1 + bonus produits) × (1 + bonus de prix) × rendement)`, où le bonus de prix est celui de l'étal (+20 %) et de « Réputation » (+3 %), le bonus produits celui de « Recettes de grand-mère » (+5 %), et le rendement celui de la récolte d'origine (fatigue du sol : 0,7 ; pollinisation manquante au niveau 10 : 0,5 ; sinon 1 ; toujours 1 pour le lait). La valeur « en l'état » d'une place est fixée à son entrée (prix brut de la récolte à ce moment, baisse du niveau 9 comprise ; revenu quotidien de l'animal pour le lait). Le cours du marché fou et la baisse de prix du niveau 9 ne touchent **pas** les produits. Le prix est calculé **à la vente** (un étal acheté entre-temps compte).

### Les bâtiments

Tous de type `upgrade` (niveaux successifs), dans `src/data/investments.js`, avec l'effet `processing`. Produits dans le nouveau fichier `src/data/products.js`.

| Bâtiment | id | Prix (niv. 1 / 2 / 3) | Places | Entretien/jour | Condition | Recettes |
|---|---|---|---|---|---|---|
| Atelier de confitures | `jamWorkshop` | **90** / 120 / 160 *(équilibré)* | 2 / 3 / 4 | 1 | — | Fraise (26) → **Confiture de fraises 46**, 2 j · Pomme (26) → **Jus de pomme 44**, 1 j |
| Fromagerie | `dairy` | 160 / 130 / 170 | 2 / 3 / 4 | 2 | posséder au moins une vache ou une chèvre | Lait de vache (16) → **Fromage de vache 30**, 2 j · Lait de chèvre (9) → **Fromage de chèvre 20**, 2 j |
| Moulin | `mill` | 150 / 130 / 200 | 2 / 3 / 4 | 1 | — | Blé (16) → **Farine 28**, 1 j (niveaux 1-2) · niveau 3 « **Four à pain** » : Blé → **Pain 44**, 2 j (remplace la farine) |

Chaînes volontairement courtes : **une seule étape** (le pain se fait directement à partir du blé quand le moulin a son four ; pas de boulangerie séparée, pas de stock de farine).

Repères : une place saturée rapporte en plus environ +10/jour (confiture), +18/jour (jus), +7/jour (fromage de vache), +5,5/jour (fromage de chèvre), +12/jour (farine), +14/jour (pain). Un atelier niveau 1 bien alimenté se rembourse en 8 à 14 jours, comme les autres investissements. Il faut **produire pour remplir** : 2 places de confiture demandent une récolte de fraises par jour (≈ 4 parcelles de fraises) ; le moulin au niveau 1 demande 2 récoltes de blé par jour (≈ 8 parcelles). C'est l'arbitrage : spécialiser son potager pour nourrir l'atelier.

### Chèvres (`goat`) et fromagerie

| Investissement | Prix | Revenu | Entretien/jour | Max | Particularité |
|---|---|---|---|---|---|
| Chèvre | 90 / 100 / 110 | +9/jour, toute l'année | 1 | 3 | La première vient avec son enclos ; lait transformable en fromage de chèvre |

- La chèvre est une « petite vache » : moins chère, moins rentable seule, mais son fromage double presque sa valeur.
- La **vache** reçoit le drapeau `milk: true` (sans changer aucun chiffre) : son lait peut aller à la fromagerie **dans les niveaux où la fromagerie existe** (9 à 12).
- Les **moutons** ne sont pas concernés (laine, tonte inchangée).
- Ordre de remplissage de la fromagerie à l'aube : vaches d'abord (lait le plus cher), puis chèvres.

### Ordre de l'aube v3

1. Pousse des cultures **et des arbres** (croissance, fruits), puis remise à zéro de l'arrosage ;
2. nouveau jour, début de saison ; gel au 1er jour d'hiver (les arbres ne gèlent pas ; bonus « Assurance gel » : remboursement des cultures assurées, calculé juste avant le gel) ;
3. météo ;
4. maladie (cultures non récoltées et pommes mûres) ;
5. la pluie arrose ;
6. marché ;
7. arrosage automatique (ignore les arbres, et les pommes de terre hors canicule) ;
8. **ateliers** : chaque place avance d'une aube ; les produits prêts sont vendus (`productSold`) ;
9. revenus des investissements ; **le lait** des vaches puis des chèvres remplit les places libres de la fromagerie allumée (ces unités ne rapportent rien aujourd'hui) ;
10. charges quotidiennes ;
11. mensualité du prêt ;
12. événements.

Fin de journée : dernier jour de l'automne au niveau 12 → **remise des prix du concours** (§ 12.6) ; puis, s'il s'agit du dernier jour d'une saison : vente en l'état si l'argent manque (ou si c'est la fin de l'année), puis fermage.

## 12.3 Transformation : interface *(v3)*

- **Acheter** : les cartes gagnent un en-tête de section (« Animaux », « Ateliers », « Aménagements ») seulement quand le niveau propose un atelier (niveaux 1 à 8 : liste inchangée). Carte d'atelier : prix, entretien, « 2 places », une ligne par recette avec icônes (« [icône fraise] 26 → confiture 46 · 2 j »), condition éventuelle (« Il faut d'abord une vache ou une chèvre »). Après achat : « Niveau 1/3 · 2 places » et bouton du niveau suivant (« +1 place » ; moulin niveau 3 : « Four à pain : du pain au lieu de la farine »).
- **Fiche du bâtiment** (toucher le bâtiment dans la scène, ou « Voir » sur la carte) — feuille du bas :
  1. grand interrupteur (≥ 48 px de haut, pleine largeur) : « Transformer mes récoltes » / « Transformer le lait » ;
  2. rangée des places (tuiles de 56 px) : icône du produit + « 1 j » ou « prêt à l'aube », place vide en pointillés ;
  3. « En cours : 3 produits, valeur à la vente 132 » ;
  4. bouton secondaire « Vendre en l'état (+52) » (confirmation) ;
  5. recettes du bâtiment ; bouton d'amélioration.
- **Scène** : le bâtiment montre ses places occupées (petits pots / fromages / sacs posés devant, 1 par place occupée), une fumée légère quand il travaille, un panneau gris quand l'interrupteur est éteint ; à la récolte, l'icône du produit vole de la parcelle au bâtiment ; à l'aube, « +46 » au-dessus du bâtiment.
- **Feuille des graines** : pour une culture transformable ici (atelier possédé), badge « Atelier : 46 » sous le prix de vente.
- **Fiche d'une parcelle mûre** transformable : « À la récolte : part à l'atelier (1 place libre) → confiture de fraises 46 » ou « Atelier plein : vendue 26 ».
- **Fiche du fermage** (barre du haut) : ligne « Produits en cours : +132 (vendus aux prochaines aubes) ». Le soir d'un fermage, si l'argent manque mais que les produits suffiraient, message « Il manque 40 pièces : vos produits seront vendus en l'état ce soir » (information, le filet de sécurité agit tout seul).
- **Bilan** : section « Transformation » (produits vendus par type, revenu des produits, ventes en l'état).
- **Conseils** (bulle unique, une fois pour toutes, voir § 12.8) au premier niveau qui propose un atelier, et au premier achat d'un atelier.

## 12.4 Progression permanente : les bonus *(v3)*

### Monnaie : les étoiles

- **Étoiles gagnées** = somme des meilleures étoiles de chaque niveau (3 × 12 = 36) + étoiles offertes par certains succès (8, § 12.5) → **44 au maximum**.
- **Étoiles disponibles** = étoiles gagnées − prix des bonus achetés. Dépenser des étoiles ne retire rien des niveaux (les étoiles des cartes de niveau restent affichées).
- **Remboursement libre** : « Rembourser tous les bonus » (confirmation) rend toutes les étoiles dépensées ; on peut ensuite racheter autrement. Pas de piège.
- **Interrupteur « Bonus permanents »** (grange et choix du niveau) : éteint, les parties se jouent sans aucun bonus (jeu d'origine). Il sert au succès « Pur et dur ». Le choix est mémorisé.
- Les bonus actifs sont **copiés dans la partie au lancement** (`createGame({ perks })`) : acheter ou rembourser un bonus pendant une partie ne change pas la partie en cours.

### Arbre des bonus (14 bonus, 3 paliers, 41 étoiles pour tout acheter) *(équilibré : effets réduits après simulation, voir § 12.10)*

Un palier s'ouvre selon les **étoiles gagnées** (pas disponibles) : palier 1 dès le début, palier 2 à **8 étoiles gagnées**, palier 3 à **18**.

| Palier | Bonus | id | Prix | Effet exact | Système touché |
|---|---|---|---|---|---|
| 1 | Almanach | `almanac` | 1 | La météo d'**après-demain** s'affiche aussi (prévision exacte : lue sans consommer l'aléatoire) | météo (affichage) |
| 1 | Bas de laine | `startPurse` | 2, puis 3 (2 rangs) | Argent de départ **+10** (rang 1), **+15** (rang 2) | départ |
| 1 | Graines sélectionnées | `goodSeeds` | 2 | Prix des graines × 0,95, arrondi à l'unité (au moins 1) ; pas les pommiers | graines |
| 1 | Bon voisinage | `goodNeighbor` | 2 | Fermage de **printemps** × 0,95 (arrondi) | fermage |
| 2 | Main verte | `greenThumb` | 3 | Pousse **+5 %** hors hiver (s'ajoute aux ruches ; cultures et arbres) | pousse |
| 2 | Marchandage | `haggler` | 3 | Investissements et ateliers × 0,95 (arrondi) | investissements |
| 2 | Arpenteur | `surveyor` | 2 | Chaque parcelle achetée coûte **5 de moins** | parcelles |
| 2 | Ferme économe | `frugal` | 3 | Entretien des animaux et des bâtiments **−1/jour** (jamais en dessous de 0 ; les 5 pièces de la ferme ne changent pas) | charges |
| 2 | Recettes de grand-mère | `grandmaRecipes` | 2 | Produits transformés **+5 %** | transformation |
| 3 | Réputation | `famousStand` | 4 | Tous les prix de vente **+3 %** (récoltes et produits ; s'ajoute à l'étal : +23 % avec lui) | ventes |
| 3 | Artisan | `artisan` | 3 | **+1 place** dans chaque atelier | transformation |
| 3 | Arboriste | `orchardist` | 3 | Pommiers **−10** pièces, adultes **2 jours plus tôt** (4 j) | arbres |
| 3 | Assurance gel | `frostInsurance` | 3 | Au gel du 1er jour d'hiver, le **prix des graines** des cultures gelées est remboursé, si elles avaient le temps de mûrir quand on les a semées (pas de remboursement pour un semis fait malgré l'avertissement « gèlera ») | gel |
| 3 | Semencier | `seedMerchant` | 5 | Pomme de terre, fraise, courgette, citrouille et pommier disponibles dans les niveaux 1 à 8 (sans effet aux niveaux 9 à 12) | cultures |

Total : 1 + 5 + 2 + 2 + 3 + 3 + 2 + 3 + 2 + 4 + 3 + 3 + 3 + 5 = **41 étoiles**. Tout acheter demande presque toutes les étoiles du jeu : c'est un objectif de long terme.

Garde-fous d'équilibrage (vérifiés par la simulation, § 12.10) : les bonus sont **modestes** et **ne changent aucun chiffre des niveaux** ; s'ils rendent un niveau trop facile, ce sont les bonus qu'on réduit.

### Grange aux souvenirs — onglet « Bonus » (téléphone)

- En haut : gros compteur « ★ 7 disponibles » (+ « 21 gagnées ») ; interrupteur « Bonus pendant les parties ».
- Trois sections (paliers) ; palier fermé : grisé avec « Il faut 8 étoiles gagnées (encore 3) ».
- Carte de bonus (pleine largeur, ≥ 72 px) : icône, nom, effet en une phrase, pastilles de rang, bouton « ★ 3 » (ou « Acquis ✓ »). Toucher le bouton → achat immédiat (son, petite animation), sans confirmation (remboursable).
- Pied : « Rembourser tous les bonus » (bouton secondaire, confirmation).

## 12.5 Succès *(v3)*

Conditions mesurables à partir de l'état de la partie (`query.achievementContext()`), des statistiques cumulées (`progress.lifetime`) et de la progression. Vérifiés **à chaque aube**, à chaque fin de partie et au démarrage (succès de progression déjà acquis par une sauvegarde v2 : débloqués d'un coup, message « 3 succès débloqués grâce à vos anciennes parties »). Un succès débloqué l'est pour toujours.

« Cumul » = toutes parties confondues : la partie en cours compte immédiatement (cumul enregistré + statistiques de la partie), et ses chiffres sont ajoutés au cumul à la fin de la partie (victoire, faillite ou abandon par « Quitter » / « Recommencer »).

| # | id | Nom | Condition | Récompense |
|---|---|---|---|---|
| 1 | `firstHarvest` | Premier panier | Récolter une culture | 5 écus |
| 2 | `harvest100` | Cent paniers | 100 récoltes (cumul) | ★ + 10 écus |
| 3 | `harvest500` | Grenier plein | 500 récoltes (cumul) | ★ + 20 écus |
| 4 | `allCrops` | Herbier complet | Avoir récolté chacune des 11 cultures et des pommes (cumul) | ★ + 20 écus |
| 5 | `goldenSeason` | Saison dorée | 500 pièces de ventes de récoltes en une seule saison | 20 écus |
| 6 | `noLoss` | Rien ne se perd | Gagner une année (niveau ≥ 2) sans culture perdue (gel ni maladie) | 20 écus |
| 7 | `pumpkinKing` | Roi de la citrouille | 10 citrouilles récoltées dans la même année | 20 écus |
| 8 | `orchard` | Le verger | 6 pommiers adultes en même temps | 20 écus |
| 9 | `henHouse` | Basse-cour | 3 poulaillers | 10 écus |
| 10 | `herd` | Le troupeau | Au moins une vache, un mouton et une chèvre en même temps | 15 écus |
| 11 | `fullFarm` | Ferme complète | Au moins un exemplaire de chaque investissement proposé dans le niveau | 30 écus |
| 12 | `greenEnergy` | Énergie verte | Charges quotidiennes à 0 | 10 écus |
| 13 | `firstProduct` | Fait maison | Vendre un produit transformé | 5 écus |
| 14 | `artisan50` | Artisan du terroir | 50 produits transformés vendus (cumul) | ★ + 20 écus |
| 15 | `cheeseMaster` | Maître fromager | 10 fromages de chèvre vendus dans la même année | 20 écus |
| 16 | `baker` | Le boulanger | Vendre un pain | 10 écus |
| 17 | `firstYear` | Première année réussie | Gagner le niveau 1 | 10 écus |
| 18 | `veteran` | Fermier aguerri | Gagner les niveaux 1 à 8 | ★ + 30 écus |
| 19 | `lifetime` | Une vie à la ferme | Gagner les 12 niveaux | ★ + 50 écus |
| 20 | `risingStar` | Étoile montante | ★★★ sur 5 niveaux | ★ + 20 écus |
| 21 | `modelFarm` | Ferme modèle | ★★★ sur les 12 niveaux | 100 écus |
| 22 | `strongbox` | Coffre-fort | Finir une année avec 1 500 pièces ou plus | 30 écus |
| 23 | `closeCall` | Sur le fil | Payer un fermage et garder moins de 10 pièces | 10 écus |
| 24 | `purist` | Pur et dur | ★★★ sur un niveau ≥ 2 avec les bonus permanents éteints | ★ + 30 écus |
| 25 | `handmade` | À la force des bras | Gagner une année (niveau ≥ 2) sans acheter d'investissement | 20 écus |
| 26 | `prettyFarm` | Jolie ferme | 10 décorations posées en même temps | 20 écus |

8 succès donnent une étoile (2, 3, 4, 14, 18, 19, 20, 24). Icônes : dessinées par l'agent graphique (une par succès, version grisée pour « pas encore »).

Onglet « Succès » de la grange : « 12 / 26 » en haut ; liste (lignes ≥ 64 px) : icône, nom, condition, récompense, date d'obtention ou **barre de progression** pour les compteurs (« 63 / 100 récoltes »). Débloqué en partie : message « Succès : Premier panier · +5 écus » (son doux, jamais de pause).

## 12.6 Nouveaux niveaux 9 à 12 *(v3)*

Déblocage : comme avant, le niveau *n* s'ouvre quand le niveau *n − 1* est terminé (le 9 après le 8). Sur l'écran des niveaux, les niveaux 9 à 12 portent un badge « Nouveau » tant qu'ils n'ont pas été joués, et les icônes des systèmes qu'ils utilisent (atelier, arbre, chèvre, coupe).

Nouveaux champs de niveau (valeurs par défaut entre parenthèses, qui laissent les niveaux 1 à 8 identiques) : `modifiers.rawPriceFactor` (1) : multiplicateur du prix de vente **brut** des récoltes (pas des produits) ; `modifiers.pollination` (false) : tant qu'on ne possède aucune ruche, une récolte de pommes a un **rendement de 0,5** (panier vendu à moitié prix, arrondi ; jus de pomme à moitié prix aussi, comme la fatigue du sol) ; `startTrees` ([]) : index des parcelles qui portent un pommier **adulte** au départ ; `contest` (null) : concours (voir niveau 12). Et `crops` devient une liste explicite pour tous les niveaux.

### Niveau 9 — « L'atelier de confitures »

*Les fruits frais se vendent mal cette année (−25 %), mais confitures et jus partent comme des petits pains. Installez l'atelier et faites mûrir vos premiers pommiers.*

- Contrainte : `rawPriceFactor: 0.75` (toutes les récoltes vendues brutes). Les produits sont au prix plein : la transformation est **le** moteur de l'année.
- Cultures : les 7 d'origine + pomme de terre, fraise, courgette, citrouille, pommier.
- Investissements : poulailler, ruche, étal, mouton, arrosage automatique, panneau solaire, **atelier de confitures**.

### Niveau 10 — « Le verger de grand-père »

*Vous héritez de quatre vieux pommiers. Sans abeilles, ils ne donnent que des demi-récoltes : il faudra des ruches, et un atelier pour le jus.*

- Grille **4 × 4** ; 12 parcelles ouvertes (4 × 3), 16 au plus ; **4 pommiers adultes** sur la première ligne (`startTrees: [0, 1, 2, 3]`).
- Contrainte : `pollination: true` (rendement des pommes 0,5 tant qu'aucune ruche n'est achetée).
- Cultures : toutes. Investissements : poulailler, ruche, étal, mouton, chèvre, arrosage automatique, panneau solaire, atelier de confitures.

### Niveau 11 — « La ferme de montagne »

*Là-haut, l'été est court et l'hiver long. Trop de pente pour les vaches, trop froid pour les tomates : place aux chèvres, au fromage et aux pommes de terre.*

- Grille 5 × 3 ; **9 parcelles ouvertes** (3 × 3), 15 au plus. Saisons **7 - 5 - 7 - 10** jours.
- Météo « montagne » (pas de canicule, neige fréquente) : printemps soleil 4, nuages 3, pluie 3, neige 1 ; été soleil 5, nuages 3, pluie 2, orage 1 ; automne soleil 3, nuages 4, pluie 3, orage 1, neige 1 ; hiver soleil 2, nuages 3, neige 6.
- Cultures : carotte, navet, blé, chou, pomme de terre, fraise, pommier (pas de tomate, maïs, tournesol, courgette, citrouille).
- Investissements : poulailler, ruche, étal, mouton, **chèvre**, **fromagerie**, arrosage automatique, panneau solaire, chambre d'hôte (pas de vache).

### Niveau 12 — « Le concours du village »

*Le village organise son grand concours d'automne : plus belles citrouilles, produits du terroir, fromages. Chaque épreuve réussie rapporte un prix… et le fermage d'hiver est salé.*

- Tous les systèmes : toutes les cultures, tous les investissements (dont chèvre, fromagerie, atelier de confitures, moulin).
- **Concours** (`contest`) : jugé le **soir du dernier jour de l'automne** (jour 21), juste avant le fermage d'automne. Trois épreuves, comptées depuis le début de l'année :
  - « Citrouilles géantes » : récolter **6 citrouilles** ;
  - « Étal du terroir » : vendre **12 produits transformés** ;
  - « Fromage de la ferme » : vendre **3 fromages** (vache ou chèvre).
  - Prix : **120 pièces par épreuve réussie**, + **120** si les trois le sont (480 au plus). Pas de pénalité si on échoue : juste pas de prix.
- Interface : bandeau au début (« Concours du village : jugement le soir du 21ᵉ jour »), section « Concours » en haut du Bilan (3 lignes avec barre de progression, « 4 / 6 citrouilles »), message quand une épreuve est réussie, fenêtre de remise des prix avant le bilan de fin d'automne.

### Tableau des réglages *(équilibré)*

| # | Départ | Grille · parcelles (ouvertes / max) | Saisons (jours) | Fermages (printemps → hiver) | ★★ / ★★★ | Réglages |
|---|---|---|---|---|---|---|
| 9 | 300 | 6 × 4 · 12 / 24 | 7-7-7-7 | 50 / 100 / 180 / 400 | 380 / 460 | Récoltes brutes −25 % ; atelier de confitures (90) |
| 10 | 180 | 4 × 4 · 12 / 16 | 7-7-7-7 | 60 / 120 / 240 / 440 | 320 / 600 | 4 pommiers adultes ; pollinisation |
| 11 | 280 | 5 × 3 · 9 / 15 | 7-5-7-10 | 60 / 100 / 200 / 500 | 300 / 470 | Montagne ; pas de vache ; chèvres et fromagerie |
| 12 | 250 | 6 × 4 · 12 / 24 | 7-7-7-7 | 80 / 160 / 280 / 700 | 360 / 650 | Concours (jusqu'à 480 de prix) ; tous les ateliers |

Les seuils suivent la règle du § 6 : ★★★ ≈ argent médian du meilleur robot (sans bonus), ★★ atteint par la plupart des stratégies réfléchies.

## 12.7 Personnalisation *(v3)*

**Aucun effet sur le jeu** : purement décoratif, jamais d'obstacle, jamais d'avantage. Les décorations ne sont pas touchables pendant la partie (sauf en mode décoration).

### Monnaie : les écus

Monnaie **permanente et décorative**, gagnée en jouant (jamais achetée) :

- Victoire : **10 + 5 par étoile + 1 par tranche de 100 pièces finales (20 au plus)** — rejouer un niveau rapporte encore des écus.
- Faillite : **3 écus** (lot de consolation).
- Succès : 5 à 100 écus (§ 12.5).

Repères : une année gagnée ≈ 25 à 45 écus ; les 26 succès rapportent 575 écus ; tout le catalogue coûte 545 écus.

### Catalogue (`src/data/cosmetics.js`)

Un objet acheté est **débloqué pour toujours** et peut être posé sur autant d'emplacements qu'on veut.

| Catégorie | Objets (id · prix en écus) |
|---|---|
| Petit décor (1 tuile) | Massif de fleurs rouges `flowers.red` · 10, jaunes `flowers.yellow` · 10, bleues `flowers.blue` · 10, blanches `flowers.white` · 10, roses `flowers.pink` · 10 ; Banc `bench` · 20 ; Réverbère `lamp` · 25 (s'allume le soir) ; Épouvantail `scarecrow` · 20 ; Brouette `wheelbarrow` · 15 ; Nichoir `birdhouse` · 15 ; Nain de jardin `gnome` · 30 ; Boîte aux lettres `mailbox` · 15 ; Buisson taillé `hedge.bush` · 10 |
| Grand décor (2 × 2 tuiles) | Petite mare `pond` · 50 |
| Allées | Terre `path.dirt` · offert (par défaut) ; Pavés de pierre `path.stone` · 40 |
| Clôture du champ | Bois `fence.wood` · offert (par défaut) ; Palissade blanche `fence.picket` · 40 ; Muret de pierre `fence.stone` · 50 ; Haie `fence.hedge` · 45 |
| Tenue du fermier | Salopette `outfit.classic` · offerte ; Chemise à carreaux `outfit.checked` · 30 ; Tablier de jardinier `outfit.gardener` · 40 ; Ciré jaune `outfit.raincoat` · 50 (noms à ajuster aux 4 tenues dessinées) |
| Nom de la ferme | Gratuit ; 1 à 18 caractères ; par défaut « Ferme des Tilleuls » |

### Emplacements

Emplacements **prédéfinis**, avec des **identifiants stables** (les mêmes dans tous les niveaux et dans les deux dispositions) : ce qu'on pose sur « devant la maison, à gauche » s'y retrouve dans chaque niveau. Si un niveau n'a pas la place pour un emplacement (niveau 4, champ réduit…), la décoration n'y est simplement pas dessinée (elle reste enregistrée).

| id | Où (portrait) | Type |
|---|---|---|
| `porch.left`, `porch.right` | de part et d'autre de la porte de la maison | petit |
| `yard.1`, `yard.2` | cour entre la maison et le puits / le chemin | petit |
| `gate.left`, `gate.right` | de part et d'autre du portail du champ, sous la clôture | petit |
| `road.1`, `road.2`, `road.3` | bord de la route, côté ferme | petit |
| `field.corner` | coin haut du champ, dans la marge de la clôture (idéal pour l'épouvantail) | petit |
| `pond` | coin libre près de la lisière (au-dessus de la maison ou à côté de la chambre d'hôte, selon la place) | grand |
| `sign` | panneau de la ferme au bord de la route, au pied du chemin principal : affiche le **nom** | panneau (toujours présent) |
| (global) | style des chemins et de la route de la ferme | allées |
| (global) | clôture du champ | clôture |

La disposition paysage (ordinateur) place les mêmes identifiants autour de sa maison, de son portail et de sa route.

### Mode décoration (téléphone)

- Entrée : **Menu → « Décorer la ferme »** pendant une partie (la partie se met en pause, raison `decor`), ou **grange → « Ma ferme » → « Décorer »** depuis le menu principal (sur la ferme de démonstration derrière le menu).
- La barre d'onglets est remplacée par une barre « Allées · Clôture · Tenue · **Terminer** » avec le solde d'écus.
- Chaque emplacement montre un repère « + » qui respire (ou l'objet posé, souligné). Toucher un emplacement → feuille du bas « Devant la maison, à gauche » : grille de tuiles (≥ 64 px) avec icône, nom, « Posé » / « Débloqué » / « [icône écu] 20 » ; toucher un objet débloqué le pose ; un objet à débloquer demande confirmation (« Débloquer le banc pour 20 écus ? ») puis le pose ; « Retirer » en bas. Pas assez d'écus : tuile grisée avec « Il manque 5 écus ».
- Toucher le **panneau de la ferme** → feuille « Nom de la ferme » (champ texte, bouton « Valider » ; la feuille reste au-dessus du clavier grâce à `visualViewport`).
- Toucher le **fermier** ou « Tenue » → choix des 4 tenues (aperçu du sprite).
- Le nom de la ferme apparaît sur le panneau de la scène, dans le bandeau de début de niveau (« Ferme des Tilleuls · Niveau 3 »), sur l'écran de victoire et en tête de la grange.

## 12.8 Écrans et parcours (téléphone en portrait) *(v3)*

- **Menu principal** : nouveau bouton « La grange aux souvenirs » (sous « Jouer »), avec une pastille dorée si une étoile peut être dépensée ou si un succès est nouveau.
- **Grange aux souvenirs** : fenêtre haute (plein écran en portrait) avec 3 onglets segmentés en haut (≥ 48 px) : **Bonus** (§ 12.4), **Succès** (§ 12.5), **Ma ferme** (nom, tenue, écus, bouton « Décorer la ferme »). Bouton « Retour » en bas.
- **Choix du niveau** : 12 cartes (défilement) ; en haut, interrupteur « Bonus permanents : activés (5) » avec lien « Grange ».
- **Victoire** : en plus du bilan : « +35 écus », succès débloqués (icônes), et, si des étoiles sont disponibles, « Vous avez 3 étoiles à dépenser » avec bouton « Grange aux souvenirs ».
- **Partie** : onglet Acheter (sections si ateliers), fiches des ateliers, fiche du pommier, Bilan (Transformation, Concours), Menu (+ « Décorer la ferme »).
- **Fiche d'un pommier** : étape (« Jeune plant · adulte dans 4 j », « En fleurs · pommes dès l'été », « Pommes dans 2 j », « Pommes mûres : 26 », « Au repos pour l'hiver »), et en bas « Arracher le pommier » (bouton rouge secondaire, confirmation). Toucher un pommier sans pommes mûres ouvre sa fiche ; avec des pommes mûres, récolte immédiate (et le glisser récolte aussi).
- **Feuille des graines** : ligne du pommier « Pommier · 45 · adulte en 6 j, puis un panier (26) tous les 3 j en été et en automne » + avertissement « Aucune pomme avant la fin de l'année » si c'est le cas ; pommes de terre : « Pousse sans arrosage ».

### Conseils (première fois seulement)

Bulle courte (2 lignes au plus) avec « Compris », partie en pause, mémorisée dans la progression (`hintsSeen`), jamais par-dessus sa cible (même règles que le tutoriel) :

| id | Quand | Texte |
|---|---|---|
| `processing` | premier niveau qui propose un atelier | « Nouveau : les ateliers transforment vos récoltes en produits plus chers, vendus tout seuls à l'aube. » |
| `processingBought` | premier atelier acheté (vise sa fiche) | « Interrupteur allumé : les récoltes compatibles y partent tant qu'il reste une place. Sinon, elles se vendent comme d'habitude. » |
| `tree` | premier pommier dans la feuille des graines | « Le pommier reste toute l'année : pas d'arrosage, pas de gel, des pommes en été et en automne. » |
| `goat` | première chèvre proposée | « Les chèvres donnent du lait chaque jour ; avec une fromagerie, il devient du fromage. » |
| `pollination` | début du niveau 10 | « Sans abeilles, vos pommiers donnent moitié moins. Pensez à la ruche ! » |
| `contest` | début du niveau 12 | « Concours le soir du 21ᵉ jour : 6 citrouilles, 12 produits, 3 fromages. Chaque épreuve rapporte 120. » |
| `grange` | retour au menu avec au moins 1 étoile disponible | « Vos étoiles achètent des bonus dans la grange aux souvenirs. » |
| `decor` | premier retour au menu avec au moins 10 écus | « Vos écus décorent la ferme : Grange → Ma ferme. » |

### Ordinateur (paysage)

Mêmes fenêtres (centrées) ; la grange s'ouvre en fenêtre large avec les onglets en haut ; le mode décoration marche à la souris (survol = nom de l'emplacement). Raccourci : D = décorer (en partie).

## 12.9 Sauvegarde et migration *(v3)*

- **Partie en cours** : `STATE_VERSION` passe de 1 à **2**. `loadGame()` **migre** une sauvegarde v1 (qui ne peut être que des niveaux 1 à 8) au lieu de la refuser : ajoute `perks: {}`, `fruit: 0` sur chaque parcelle, `processing: {}`, `contest: null`, les nouveaux compteurs de statistiques à 0. Une partie v2 en cours se termine donc sans bonus, exactement comme avant. Une version inconnue (> 2) reste refusée (« Continuer » masqué).
- **Progression** (clé `une-annee-a-la-ferme.progress`) : champ `schema: 2` ajouté. Une progression v1 (`{ levels }`) est lue telle quelle et complétée : étoiles et records conservés, aucun bonus, 0 écu, cumuls à 0, cosmétiques par défaut. Au premier démarrage v3, les succès de progression (niveaux gagnés, ★★★) sont évalués et débloqués (écus et étoiles offerts compris).
- Tout champ abîmé est remplacé par sa valeur par défaut (même politique que v2) ; une référence inconnue (bonus, objet, emplacement retiré d'une future version) est ignorée.
- « Effacer la progression » (options) efface aussi bonus, succès, écus et décorations (texte de confirmation explicite).

## 12.10 Simulation *(v3)*

`tools/simulate.js` gagne :

- `--perks none|all|<id,id…>` (défaut `none`) et `--compare-perks` (tableau côte à côte sans / avec tous les bonus) ;
- des robots qui connaissent les nouveaux systèmes, **par l'API publique seulement** :
  - **careless** : inchangé (graines les moins chères parmi les cultures du niveau, jamais d'atelier ni d'arbre) ;
  - **balanced** : ordre d'achat fixe par niveau, où l'atelier du niveau vient juste après le premier poulailler ; plante des pommiers au printemps sur au plus 1/4 des parcelles quand le niveau en propose ; nourrit l'atelier (préfère la culture transformable quand une place sera libre à maturité) ;
  - **investor** : achète tout, ateliers et chèvres compris ;
  - **optimal** : `purchaseValue` étendu (valeur attendue d'un atelier = gain par produit × produits qu'il pourra réellement recevoir d'ici la fin de l'année, compte tenu des parcelles et des animaux ; chèvre = revenu + fromage si fromagerie) ; plante des pommiers seulement si ≥ 3 paniers sont attendus ; au niveau 12, vise les épreuves du concours dont le prix dépasse le manque à gagner ;
  - tous : interrupteurs allumés ; « Vendre en l'état » inutile (le filet de sécurité agit), mais la réserve du fermage compte les produits en cours à leur valeur en l'état.
- Mesures en plus : part du revenu venant des produits, des arbres, du lait ; prix du concours obtenus.

### Cibles

| Cas | Cible |
|---|---|
| Niveaux 1 à 8, sans bonus | **Identiques à la v2** (mêmes chiffres, graine par graine) |
| Niveaux 9 à 12, sans bonus | careless : faillite ≥ 60 % (≥ 50 % au 9) ; balanced : victoire ≥ 90 % ; optimal : victoire ≥ 95 %, ★★★ pour 50 à 100 % de ses parties ; ★★ pour ≥ 60 % des parties de balanced |
| Le système du niveau compte | niveau 9 : produits ≥ 25 % du revenu de l'optimal ; niveau 10 : pommes ≥ 20 % ; niveau 11 : lait + fromage ≥ 25 % ; niveau 12 : l'optimal réussit ≥ 2 épreuves dans ≥ 70 % des parties |
| Tous les bonus, niveaux 1 à 12 | balanced et optimal gagnent ≥ 95 % ; careless reste en faillite dans ≥ 50 % des parties aux niveaux 2, 4, 5, 7, 8, 9 à 12 et ≥ 35 % aux niveaux 3 et 6 ; argent médian de l'optimal **+30 % au plus** par rapport à sans bonus |

Si une cible « tous les bonus » n'est pas tenue, on réduit les bonus (jamais les chiffres des niveaux 1 à 8).

### Résultats *(équilibré, 2026-09-30, 200 parties par niveau et par stratégie)*

Niveaux 1 à 8 sans bonus : **identiques à la v2**, partie par partie (tableau de la simulation v2 reproduit à l'identique ; `tests/parity.test.js`). Seule exception, voulue (intégration, 2026-09-30) : le robot optimal du niveau 2 n'achète plus une parcelle qu'il ne pourrait pas semer et arroser (arrosage payant) ; 2 parties sur 30 de la parité changent, argent médian 437 → 445 (le cœur, lui, reste identique à la v2 : 400 parties des robots scriptés).

Niveaux 9 à 12, sans bonus (victoires · argent médian · ★★★) :

| # | careless | balanced | investor | optimal | Le système compte |
|---|---|---|---|---|---|
| 9 | 0 % · 291 | 100 % · 525 · ★★★ 100 % | 100 % · 583 | 100 % · 462 · ★★★ 100 % | produits 27 % du revenu de l'optimal (36 % pour balanced), pommes 14 % |
| 10 | 0 % · 345 | 100 % · 335 · ★★ 100 % | 100 % · 635 | 100 % · 616 · ★★★ 100 % | pommes (brutes + jus) 21 % |
| 11 | 0 % · 383 | 98 % · 415 · ★★ 98 % | 100 % · 418 | 100 % · 477 · ★★★ 100 % | lait + fromage 26 % |
| 12 | 0 % · 363 | 100 % · 378 · ★★ 100 % | 100 % · 570 | 100 % · 655 · ★★★ 100 % | concours : l'optimal réussit 2 épreuves dans 100 % des parties (240 de prix) |

Les parties des niveaux 9 à 12 dépendent peu de la graine (robots qui arrosent tout, peu de hasard hors météo) : les seuils sont placés juste sous l'argent médian (★★★ : optimal ; ★★ : balanced).

Tous les bonus (bonus réduits après une première simulation : Bas de laine +10/+15, graines × 0,95, fermage de printemps × 0,95, parcelles −5, Ferme économe sur l'entretien seulement, produits +5 %, Réputation +3 %, Assurance gel pour les semis faits à temps, Semencier limité aux niveaux 1 à 8) :

| Cible | Résultat |
|---|---|
| balanced et optimal gagnent ≥ 95 % | tenu partout sauf aux niveaux 3 et 6 (balanced 92 % / 90 %, optimal 92 % / 92 %) — **déjà sous 95 % sans bonus en v2** (89 à 95 %), aucun réglage des bonus ne peut y remédier ; les bonus n'y font pas baisser les victoires (sauf optimal au niveau 3 : 95 → 92 %, dans le bruit) |
| careless en faillite ≥ 50 % (2, 4, 5, 7, 8, 9 à 12) et ≥ 35 % (3, 6) | tenu : 100 % aux niveaux 2, 4, 5, 7 à 12 ; 39 % au niveau 3 ; 82 % au niveau 6 (le niveau 1 reste gagné par tous, comme en v2) |
| argent médian de l'optimal + 30 % au plus | tenu aux niveaux 1 (+14 %), 2 (+24 %) et 3 (+28 %) ; **non tenu ailleurs** (+39 % à +237 %) |

Niveau 2 avec tous les bonus : le premier tableau donnait **−20 %** (437 → 348). Aucun bonus n'y nuit par ses règles : c'était le robot optimal. Pris seul, « Bas de laine » faisait tomber l'optimal de 437 à 164 et « Arpenteur » à 324 : un peu d'argent en plus (ou des parcelles moins chères) lui faisait acheter des parcelles dès le printemps, sans garder de quoi semer **et arroser** (1 pièce par arrosage) ; l'été, la moitié du champ restait vide. « Semencier » faisait perdre 16 % des parties : le robot arrosait ses pommes de terre les jours de canicule (arrosage facultatif pour elles) jusqu'à ne plus pouvoir payer le fermage. Un joueur n'est jamais forcé à ces choix ; les deux robots sont corrigés (`canFarmMorePlots`, `skipOptionalWater` dans `tools/simulate.js`) : 445 → 554 (+24 %), Bas de laine seul 452, Arpenteur seul 437, Semencier seul 100 % de victoires. Au niveau 3 (optimal 95 → 92 % de victoires avec les bonus), c'est la pourriture : avec plus d'argent, le robot sème davantage de maïs et de blé, à la merci d'une série de jours de pluie (hasard, pas une règle).

Pourquoi la dernière cible n'est pas tenue : l'économie est **à effet boule de neige** et les robots « gelés » par la parité (leurs décisions des niveaux 1 à 8 doivent rester celles de la v2) sont souvent juste sous un seuil de décision. Exemple mesuré : au niveau 5, **10 pièces de plus au départ, sans aucun bonus**, font passer l'optimal de 2 poulaillers à 3 vaches et son argent final de 269 à 487 (+81 %). Chaque bonus pris seul rapporte à l'optimal de 0 à ~100 pièces (souvent moins que ce seuil), mais les 14 réunis se composent. Réduire encore les bonus les rendrait insignifiants pour un joueur sans tenir la cible (tout gain de ~10 pièces franchit ces seuils). Le robot insouciant, lui, n'en profite presque pas (+5 à +20 pièces, sauf +90 au niveau 2) : les bonus récompensent le joueur qui investit, sans rendre les niveaux triviaux (★★★ reste à conquérir sans bonus, et « Pur et dur » l'exige).

## 12.11 Plan de réalisation *(v3)*

Trois lots menés **en parallèle** par trois agents, sur les contrats de `docs/ARCHITECTURE.md` (section « v3 »). Chacun peut commencer tout de suite : les identifiants (cultures, produits, bâtiments, bonus, succès, objets, emplacements) sont fixés dans ce document.

**Lot CORE** — `src/data/`, `src/core/`, `src/storage.js`, `tests/`, `tools/simulate.js`
1. Avant tout changement : `tools/capture-parity.js` enregistre `tests/fixtures/parity-v2.json` (niveaux 1 à 8 × 3 graines : robot scripté déterministe, argent et statistiques de fin) ; `tests/parity.test.js` vérifie ensuite l'égalité exacte sans bonus.
2. Données : `crops.js` (4 cultures + pommier, `BASE_CROPS`), `products.js`, `investments.js` (chèvre, 3 ateliers, `milk` sur la vache), `levels.js` (listes explicites, niveaux 9 à 12, nouveaux champs), `perks.js`, `achievements.js`, `cosmetics.js`.
3. Cœur : arbres, pomme de terre, transformation, bonus, concours, `STATE_VERSION` 2 + migration, nouvelles actions / requêtes / événements, `progression.js` (pur), `storage.js` (schéma 2).
4. Tests (arbres, ateliers, filets de sécurité, bonus un par un, concours, migration v1 → v2, progression, succès) ; simulation (robots, `--perks`) ; équilibrage des niveaux 9 à 12 et des bonus ; mise à jour des tableaux de ce document.

**Lot UI** — `src/ui/`, `css/style.css`, `src/main.js`, `src/index.template.html`
1. Grange (3 onglets), choix du niveau (12 niveaux, interrupteur des bonus), victoire (écus, succès, étoiles), messages de succès, conseils (`hints`).
2. Partie : cartes Acheter (sections, ateliers), fiche d'atelier (interrupteur, places, vendre en l'état), fiche du pommier (arracher), feuille des graines (pommier, badges), fiche du fermage (produits en cours), Bilan (Transformation, Concours), Menu → Décorer.
3. Mode décoration (barre, feuilles d'emplacement, nom, tenue).
4. `main.js` : `createGame({ perks })`, enregistrement de fin de partie (`progression.recordRunEnd`), vérification des succès à chaque aube, cumul à l'abandon, câblage des nouveaux événements vers le rendu et l'audio.
5. Vérification au doigt (Playwright, Pixel 7, 360 × 740) : cibles ≥ 48 px, textes ≥ 12 px, aucun débordement, niveaux 9 à 12 joués en entier.

**Lot RENDER** — `src/render/` (+ intégration des sprites dans `assets/sprites/` et `CREDITS.md` avec l'agent graphique)
1. Atlas : 4 cultures (5 étapes, icône, sachet), pommier (3 étapes × 4 saisons, fruits), chèvre, 5 produits, 3 bâtiments, décorations, 4 tenues, icônes de bonus et de succès.
2. Dispositions portrait et paysage : emplacements `goat`, `dairy`, `jamWorkshop`, `mill` (bandes retirées quand le niveau ne les propose pas, comme les vaches), emplacements de décoration (§ 12.7), panneau de la ferme.
3. Scène : arbres selon la saison, chèvres qui se promènent, ateliers (places occupées, fumée, panneau éteint), vol du produit vers l'atelier, décorations, styles d'allée et de clôture, nom sur le panneau, tenue du fermier, repères du mode décoration.

Intégration par le chef de projet : `node --test tests/`, `node tools/simulate.js --compare-perks`, `node tools/build.js`, journal, sauvegarde `backup/…` avant fusion.

---

# 13. Difficulté et équilibre « détente » (2026-09-30)

## 13.1 Pourquoi

Retour du joueur (téléphone Android, niveau 1, vitesse ×1) : **faillite presque inévitable, dès le premier fermage**. Cause : tout l'équilibrage (§ 8, § 12.10) avait été réglé avec des robots qui arrosent, récoltent et replantent **chaque parcelle chaque jour**. Au niveau 1 classique, on part avec 100 pièces et le printemps coûte 35 de charges + 60 de fermage : il fallait regagner presque tout en 7 jours de 20 secondes, en jouant parfaitement — et le tutoriel occupe une partie du printemps (une seule carotte le 1er jour, puis le poulailler conseillé dès 70 pièces). Un joueur simulé « tranquille » (§ 13.4) fait faillite dans **100 %** des parties au niveau 1 classique.

Intention retenue (demande du joueur) : **facile et relaxant** — on gagne presque toujours en jouant normalement ; les étoiles récompensent le bon jeu ; la faillite n'arrive que si l'on fait vraiment n'importe quoi.

## 13.2 Deux modes

- **Détente** (défaut de toute nouvelle partie) : l'équilibre ci-dessous.
- **Classique** : exactement les chiffres d'avant (§ 3 à § 12), pour qui veut le défi d'origine. Les parties sauvegardées avant l'arrivée des modes continuent en classique (pas de surprise en cours de partie).
- Le mode se choisit pour les nouvelles parties (progression : `difficulty`) ; une seule fiche d'étoiles par niveau, qui garde le meilleur résultat, quel que soit le mode.
- Un mode ne change que des **nombres** : chaque niveau garde sa contrainte (sécheresse et arrosage payant, maladie, petit lopin, hiver de 14 jours, marché fou, crédit, bio, atelier, verger, montagne, concours).

## 13.3 Les leviers du mode détente

| Levier | Classique | Détente | Effet recherché |
|---|---|---|---|
| Charges de la ferme | 5 / jour | **2 / jour** | moins de pression fixe pour qui joue peu |
| Pousse d'un jour **non arrosé** | 0,5 jour | **0,75 jour** | oublier d'arroser ralentit un peu, sans tout bloquer ; arroser reste utile (1 jour) |
| Canicule, non arrosée | 0 | **0,25 jour** | idem pendant les canicules (niveau 2) |
| Prix de vente des récoltes brutes | × 1 | **× 1,25** | meilleures marges sur les cultures (pas sur les produits transformés, déjà rentables) |
| Fermages | § 8 / § 12.6 | **printemps 20 partout**, puis ~50 à 75 % | le premier fermage ne peut plus ruiner un débutant qui suit le tutoriel |
| Argent de départ | § 8 / § 12.6 | **+ 60** | de quoi semer tout le champ **et** acheter le poulailler du tutoriel |
| Niveau 7 : mensualité | 150 | **120** (description adaptée) | le crédit reste la contrainte, sans étrangler le joueur tranquille |
| Filet de sécurité | faillite immédiate | **le prêt du voisin** (§ 13.5) | un faux pas (achat juste avant le fermage, saison ratée) se rattrape |

Pourquoi pas seulement « tout moins cher » : les coûts fixes (charges, fermages) sont ce qui tue le joueur tranquille ; les baisser l'aide beaucoup plus que le robot parfait. Le prix des récoltes (× 1,25) et la pousse sans arrosage (0,75) donnent de la marge à qui plante sans optimiser. Le prêt du voisin couvre les accidents sans rendre la faillite impossible.

### Niveaux en mode détente *(équilibré)*

| # | Départ | Fermages (printemps → hiver) | ★★ / ★★★ | Réglage propre |
|---|---|---|---|---|
| 1 | 160 | 20 / 60 / 90 / 130 | 300 / 490 | tutoriel |
| 2 | 180 | 20 / 60 / 80 / 120 | 130 / 420 | arrosage 1 pièce |
| 3 | 160 | 20 / 50 / 100 / 170 | 150 / 360 | maladie 5 % |
| 4 | 260 | 20 / 60 / 90 / 120 | 320 / 510 | 6 parcelles |
| 5 | 160 | 20 / 80 / 140 / 500 | 180 / 380 | hiver de 14 jours |
| 6 | 160 | 20 / 70 / 130 / 300 | 150 / 360 | marché fou |
| 7 | 660 | 50 / 150 / 230 / 360 | 90 / 310 | crédit : **120** aux jours 4, 11, 18, 25 |
| 8 | 160 | 20 / 80 / 130 / 240 | 190 / 380 | bio |
| 9 | 360 | 20 / 60 / 120 / 260 | 100 / 250 | récoltes brutes −25 % (× 1,25 du mode : × 0,94) |
| 10 | 240 | 20 / 90 / 200 / 420 | 440 / 620 | pommiers sans ruche : demi-récolte |
| 11 | 340 | 20 / 80 / 160 / 440 | 200 / 360 | montagne |
| 12 | 310 | 20 / 100 / 190 / 480 | 190 / 420 | concours |

Seuils d'étoiles : ★★ ≈ argent final médian du joueur tranquille (la moitié l'obtient) ; ★★★ ≈ ses 12 % meilleures parties — un joueur appliqué (qui arrose tout, comme les robots) l'obtient à coup sûr.

## 13.4 Joueurs humains simulés (`tools/simulate.js`)

Les robots d'origine (careless, balanced, investor, optimal) jouent parfaitement. Trois modèles de joueurs humains s'y ajoutent, avec leur propre tirage (déterministe : graine × niveau × stratégie, sans jamais consommer les tirages du jeu), par l'API publique seulement :

| | casual (joueur tranquille, ×1, téléphone) | novice (débutant) | idle |
|---|---|---|---|
| Gestes par jour | 7 à 11 (glisser pour arroser / récolter : 1 geste + ¼ par parcelle ; « semer partout » : 3) | 4 à 8 | — |
| Jours sans rien faire | 10 % | 15 % | tous sauf le 1er |
| Arrosage | 50 à 70 % des parcelles qui en ont besoin | 20 à 40 % | une fois |
| Récolte | le jour même 70 %, sinon le lendemain ; tout le soir du fermage | 50 %, jusqu'à 2 jours de retard | jamais |
| Replantation | 75 % des jours, « semer partout » une culture tirée au hasard parmi celles qu'on peut payer (surtout bon marché et rapides ; ×2 pour celle que l'atelier transforme) | 60 % des jours ; carottes et navets, sinon la moins chère | une fois, la moins chère |
| Gel annoncé | en tient compte 80 % du temps | 30 % | — |
| Achats | 1 regard par jour sur deux : liste d'envies (poulailler, puis ce que suggère le niveau : atelier, chèvre, ruches, arrosage automatique…), marge de 0 à 40 pièces ; n'achète pas ce qui mettrait le fermage « dans le rouge » (70 % du temps) ; parcelle rarement | surtout des poulaillers, **sans regarder le fermage** (peut acheter juste avant) | rien |
| Niveau 1 | tutoriel : une seule carotte le 1er jour ; poulailler conseillé dès 70 pièces (80 %) | idem (100 %) | — |
| Prévisions météo | ignorées | ignorées | — |

## 13.5 Le prêt du voisin (mode détente)

Joseph, le voisin du tutoriel, avance l'argent d'un fermage manqué. Règles exactes (`src/core/neighbour.js`, déterministes, sauvegardées dans `state.neighbourLoan`) :

1. Le soir d'un fermage, après la vente en l'état des ateliers, si l'argent ne suffit pas **et** qu'on ne doit rien à Joseph **et** qu'il manque au plus **max(60 pièces, la moitié du fermage)**, Joseph prête automatiquement **ce qui manque + 30 pièces** pour ressemer (pas de supplément au dernier fermage de l'année). Le fermage est payé normalement.
2. On lui doit la somme prêtée **+ 10 %** (arrondi à la pièce supérieure).
3. Remboursement automatique : **la moitié de chaque vente** (récolte vendue, produit transformé vendu à l'aube ; arrondi supérieur, au plus ce qui reste dû) lui revient tant que la dette n'est pas réglée. On peut aussi le rembourser quand on veut.
4. Une fois remboursé, Joseph peut aider à nouveau. Un fermage manqué **alors qu'on lui doit encore de l'argent**, ou avec un manque au-delà du plafond → **faillite**.
5. Fin d'année : après le fermage d'hiver, Joseph reprend ce qui lui est dû dans la limite de l'argent restant et **efface le reste** (l'argent final n'est jamais négatif à cause de lui) ; les étoiles se comptent ensuite.

Garde-fous vérifiés : semer une fois puis ne plus rien faire (« idle ») fait faillite dans **100 %** des parties, à tous les niveaux ; le prêt sert à 10–50 % des parties des joueurs humains simulés, jamais aux robots appliqués (0–4 %).

## 13.6 Résultats *(équilibré, 2026-09-30, 200 parties par niveau et par stratégie, sans bonus)*

### Victoires, détente / classique

| # | novice | casual | careless | balanced | investor | optimal | idle |
|---|---|---|---|---|---|---|---|
| 1 | **98 %** / 0 % | **100 %** / 0 % | 100 % / 100 % | 100 % / 100 % | 100 % / 100 % | 100 % / 100 % | 0 % / 0 % |
| 2 | **99 %** / 0 % | **98 %** / 0 % | 100 % / 0 % | 100 % / 100 % | 100 % / 100 % | 100 % / 100 % | 0 % / 0 % |
| 3 | **98 %** / 0 % | **99 %** / 0 % | 100 % / 31 % | 100 % / 89 % | 100 % / 95 % | 100 % / 95 % | 0 % / 0 % |
| 4 | **100 %** / 0 % | **100 %** / 0 % | 100 % / 0 % | 100 % / 100 % | 100 % / 100 % | 100 % / 100 % | 0 % / 0 % |
| 5 | **91 %** / 0 % | **98 %** / 0 % | 100 % / 0 % | 100 % / 100 % | 100 % / 100 % | 100 % / 100 % | 0 % / 0 % |
| 6 | **90 %** / 0 % | **96 %** / 0 % | 100 % / 9 % | 100 % / 89 % | 100 % / 86 % | 100 % / 89 % | 0 % / 0 % |
| 7 | **88 %** / 0 % | **92 %** / 0 % | 100 % / 0 % | 100 % / 100 % | 100 % / 100 % | 100 % / 98 % | 0 % / 0 % |
| 8 | **89 %** / 0 % | **99 %** / 0 % | 100 % / 0 % | 100 % / 100 % | 100 % / 100 % | 100 % / 100 % | 0 % / 0 % |
| 9 | **100 %** / 0 % | **97 %** / 0 % | 100 % / 0 % | 100 % / 100 % | 100 % / 100 % | 100 % / 100 % | 0 % / 0 % |
| 10 | **100 %** / 0 % | **100 %** / 22 % | 100 % / 0 % | 100 % / 100 % | 100 % / 100 % | 100 % / 100 % | 0 % / 0 % |
| 11 | **100 %** / 0 % | **100 %** / 0 % | 100 % / 0 % | 100 % / 98 % | 100 % / 100 % | 100 % / 100 % | 0 % / 0 % |
| 12 | **100 %** / 0 % | **100 %** / 0 % | 100 % / 0 % | 100 % / 100 % | 100 % / 100 % | 100 % / 100 % | 0 % / 0 % |

Cibles (détente) : niveau 1 novice ≥ 95 %, casual ≥ 99 % ; niveaux 2 à 4 casual ≥ 95 %, novice ≥ 80 % ; 5 à 8 casual ≥ 90 %, novice ≥ 65 % ; 9 à 12 casual ≥ 90 %, novice ≥ 60 % : **toutes tenues**. Le mode classique est inchangé (colonnes de droite identiques aux § 8 et § 12.10 ; test de parité).

Le robot « careless » (graines les moins chères, aucun investissement) gagne partout en détente : il arrose et replante tout, chaque jour — c'est un joueur appliqué, pas un joueur négligent ; les joueurs humains simulés sont désormais la référence du « jouer mal ».

### Étoiles et argent final (détente)

| # | casual : argent médian · ★ / ★★ / ★★★ · prêt | novice : argent médian · ★ / ★★ / ★★★ · prêt | balanced · optimal (★★★) |
|---|---|---|---|
| 1 | 309 · 47 / 42 / 12 % · 12 % | 300 · 48 / 45 / 5 % · 33 % | 2484 · 2438 (100 %) |
| 2 | 139 · 44 / 51 / 3 % · 31 % | 324 · 5 / 79 / 16 % · 46 % | 1791 · 1831 (100 %) |
| 3 | 156 · 47 / 40 / 12 % · 21 % | 244 · 18 / 65 / 16 % · 39 % | 1984 · 2026 (100 %) |
| 4 | 326 · 48 / 41 / 12 % · 1 % | 362 · 27 / 74 / 0 % · 14 % | 1149 · 1243 (100 %) |
| 5 | 190 · 48 / 39 / 12 % · 23 % | 131 · 55 / 35 / 2 % · 49 % | 2545 · 2757 (100 %) |
| 6 | 157 · 44 / 40 / 12 % · 20 % | 123 · 50 / 34 / 6 % · 53 % | 2173 · 2336 (100 %) |
| 7 | 101 · 41 / 40 / 11 % · 21 % | 0 · 78 / 10 / 0 % · 52 % | 2761 · 2951 (100 %) |
| 8 | 197 · 47 / 40 / 12 % · 11 % | 138 · 55 / 34 / 0 % · 47 % | 1998 · 2059 (100 %) |
| 9 | 112 · 45 / 39 / 14 % · 23 % | 124 · 39 / 60 / 2 % · 9 % | 1448 · 1712 (100 %) |
| 10 | 447 · 48 / 41 / 12 % · 2 % | 311 · 92 / 9 / 0 % · 9 % | 2005 · 2140 (100 %) |
| 11 | 206 · 49 / 39 / 13 % · 5 % | 163 · 72 / 28 / 0 % · 7 % | 1435 · 1486 (100 %) |
| 12 | 194 · 49 / 38 / 13 % · 14 % | 249 · 36 / 50 / 15 % · 11 % | 2565 · 2750 (100 %) |

(★ / ★★ / ★★★ : parts de TOUTES les parties, faillites non comprises.) Le joueur tranquille obtient ★★ ou mieux dans ~52 % des parties et ★★★ dans ~12 % (3 % au niveau 2) ; tous les robots appliqués ont ★★★. Au niveau 2, le novice fait mieux que le casual : l'arrosage y est payant (1 pièce) et, avec la pousse à 0,75 sans eau, arroser peu et semer des carottes est un choix raisonnable ; le seuil ★★★ (420) est placé pour qu'il reste rare pour lui (16 %).

Les robots appliqués finissent l'année avec beaucoup plus d'argent qu'en classique (1 100 à 2 900 pièces) : c'est voulu, la détente pardonne tout ; seuls les seuils d'étoiles de ce mode en tiennent compte.

Commandes : `node tools/simulate.js` (détente, toutes les stratégies), `--difficulty classique`, `--compare-modes` (tableau des victoires côte à côte), `--strategy casual --trace --level 1 --seed 3` (une partie jour par jour).

---

# 14. Mode Carrière (conception, 2026-09-30)

Le jeu a désormais **deux modes** au menu principal : **« Les niveaux »** (tout ce qui précède, 12 années à contraintes, **inchangé** : chiffres, difficultés, parité) et **« Ma ferme »**, le **mode Carrière** : sa propre ferme, qui dure d'année en année et grandit.

La conception complète, chiffrée et découpée en lots, est dans **`docs/CARRIERE.md`** ; les contrats de code dans `docs/ARCHITECTURE.md`, section « Mode Carrière — contrats ». En bref :

- **Années continues** (saisons de 7 jours, bilan de l'année chaque hiver) ; le fermage est remplacé par des **charges de saison** qui suivent la taille de la ferme (Détente : 20 + 15 par terrain acheté).
- **6 rangs** (Petite ferme → Ferme familiale → Belle ferme → Grande ferme → Exploitation modèle → **Domaine**) : patrimoine + 2 objectifs ; chaque rang débloque cultures, bâtiments, machines et terrains.
- **Terrains** : le monde est une colonne verticale ; on achète un à un les 12 terrains de la forêt au-dessus de la ferme et on les aménage (champ, pré, verger, cour des ateliers, mare, serre).
- **Bâtiments à niveaux** (maison et capacité d'employés, grenier → silo pour vendre au bon cours, serre pour l'hiver, étal → marché fermier, abris d'animaux, ateliers jusqu'au niveau 5), **8 espèces** d'animaux (poule, lapin, canard, chèvre, vache, mouton, cochon et ses truffes, cheval), **machines** (arroseurs, semoir, moissonneuse, cueilleuse, collecteur, tracteur, château d'eau, convoyeur), **employés** (jardinier, soigneur, artisan, vendeur ; salaire, niveaux, humeur simple, congés).
- **Événements vivants** : 4 fêtes au calendrier et le comice agricole, événements au hasard (visiteurs, touristes, corbeaux, arc-en-ciel…), **quêtes et amitié de Joseph**.
- **Détente par défaut, sans fin de partie** (stock et ateliers vendus, prêt de Joseph, coup dur, vente de secours limitée) ; Classique : faillite possible.
- Écus, décor et succès **partagés** avec le mode Niveaux ; les bonus permanents (étoiles) n'ont **aucun effet** en carrière.

