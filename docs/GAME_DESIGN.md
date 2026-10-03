# Game design — « Une année à la ferme »

Document de référence du gameplay. Les chiffres marqués *(équilibré)* ont été réglés avec la simulation (`tools/simulate.js`) ; la version qui fait foi vit dans `src/data/`, et ce document est mis à jour en conséquence.

> **Mode Carrière (conception 2026-09-30)** : une ferme à soi qui dure et grandit d'année en année — voir **§ 14** et `docs/CARRIERE.md`. Le mode Niveaux décrit ici ne change pas.
>
> **Lot 3 « Variété » (conception 2026-10-02)** : tableau du village, cadeau de fin de saison, charrette du marché, défis de saison, années à thème, colporteur — voir **§ 16** (désactivé en Classique).
>
> **Lot 4 « Collection & enjeux doux » (conception 2026-10-03)** : album de la ferme, lanternes de fin d'année, « aider sans remplacer » en carrière, fêtes participatives, hiver vivant — voir **§ 17** (fêtes, hiver et lanternes désactivés en Classique ; l'album se remplit dans tous les modes, hors partie).
>
> **La Vallée vivante (conception 2026-10-03)** : le grand projet long de la carrière — variétés anciennes à sauver, faune à faire revenir, étapes de la vallée, en 4 lots (V1 à V4) — voir **§ 18** et `docs/VALLEE.md` (carrière seulement ; niveaux inchangés).
>
> **Deux modes de difficulté (2026-09-30)** : les chiffres des § 3 à § 12 sont ceux du mode **classique**. Les nouvelles parties se jouent par défaut en mode **détente** (charges, fermages, départ, prix des récoltes, pousse sans arrosage et prêt du voisin) : voir **§ 13**.

## 1. Intention

- Jeu de gestion **relaxant** : pas de réflexes, pas de combat, pas de punition brutale.
- Une partie = **une année** (4 saisons), environ **17 à 20 minutes** en vitesse normale (×1), deux fois moins à ×2 (avant le 2026-10-03 : 10 à 12 minutes, jugé trop pressé sur téléphone).
- Le plaisir vient de l'**arbitrage** : dépenser pour replanter (gain rapide) ou investir dans du **revenu quotidien automatique** (gain lent mais régulier), en préparant l'**hiver** où presque rien ne pousse.
- Contrôle **100 % souris** (raccourcis clavier en bonus).

## 2. Le temps

- 1 jour = **36 secondes réelles** en vitesse ×1 (*rythme 2026-10-03*, avant : 20 s). Vitesses : pause, ×½ (72 s, option), ×1 (36 s), ×2 (18 s), ×4 (9 s).
  - Retour du joueur (téléphone, surtout en carrière) : « même en ×1 les jours passent trop vite ». Mesuré : 20 s par jour à ×1, 5 s à ×4 ; à ×1, à peine le temps de récolter et d'arroser un champ sans mettre en pause. Le jour est **1,8 fois plus long** en temps réel.
  - Les **règles par jour ne changent pas** : le cœur compte toujours un jour comme `DAY_SECONDS` = 20 « secondes de jeu » (heures de travail des employés, passages des machines, sauvegardes, simulateurs, parité des captures) ; c'est la boucle de l'interface qui fait avancer ces secondes de jeu plus lentement (`REAL_DAY_SECONDS` = 36, `src/data/balance.js`).
  - Les personnages suivent le **temps réel** : marche au pas (≈ 22 px monde/s), accélération modérée à ×2 (×1,25) et ×4 (×1,5) ; un employé dont la tâche suivante est trop loin « coupe » par un fondu au lieu de courir (docs/ARCHITECTURE.md, « Rythme et personnages »).
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
| 1 | 160 | 20 / 60 / 90 / 130 | 590 / 910 | tutoriel |
| 2 | 180 | 20 / 60 / 80 / 120 | 380 / 620 | arrosage 1 pièce |
| 3 | 160 | 20 / 50 / 100 / 170 | 380 / 690 | maladie 5 % |
| 4 | 260 | 20 / 60 / 90 / 120 | 620 / 810 | 6 parcelles |
| 5 | 160 | 20 / 80 / 140 / 500 | 580 / 920 | hiver de 14 jours |
| 6 | 160 | 20 / 70 / 130 / 300 | 370 / 730 | marché fou |
| 7 | 660 | 50 / 150 / 230 / 360 | 250 / 630 | crédit : **120** aux jours 4, 11, 18, 25 |
| 8 | 160 | 20 / 80 / 130 / 240 | 460 / 790 | bio |
| 9 | 360 | 20 / 60 / 120 / 260 | 340 / 530 | récoltes brutes −25 % (× 1,25 du mode : × 0,94) |
| 10 | 240 | 20 / 90 / 200 / 420 | 740 / 960 | pommiers sans ruche : demi-récolte |
| 11 | 340 | 20 / 80 / 160 / 440 | 450 / 720 | montagne |
| 12 | 310 | 20 / 100 / 190 / 480 | 470 / 760 | concours |

Seuils d'étoiles : ★★ ≈ argent final médian du joueur tranquille (la moitié l'obtient) ; ★★★ ≈ ses 12 % meilleures parties — un joueur appliqué (qui arrose tout, comme les robots) l'obtient à coup sûr.

*(Lot 4, 2026-10-03 : seuils recalculés avec les fêtes, l'hiver et les lanternes actifs en Détente — le lot ajoute ≈ 3,8 %
au revenu de l'année du joueur tranquille et ≈ 15 % à son argent final médian ; même règle, `node tools/simulate.js
--stars` (200 parties par niveau) : ★★ ou mieux à 49–52 % des parties du joueur tranquille, ★★★ à 11–14 % ; au niveau 2,
le débutant obtient ★★★ dans 12 % des parties. Anciens seuils (lot 3, QA) : 560/830, 310/570, 350/670, 530/750, 490/810,
340/680, 220/610, 380/730, 290/480, 670/900, 390/620, 400/680. Voir § 17.8.1.)*

*(QA du lot 3, 2026-10-02 : paliers des défis strictement croissants (« Potager varié » et « Semeur curieux » non proposés quand trop peu de cultures sont faisables) et commande gardée d'office au semis : l'argent final médian du joueur tranquille bouge de quelques pour cent selon le niveau ; même règle, `node tools/simulate.js --stars` (200 parties par niveau) : ★★ ou mieux à 49–52 % des parties du joueur tranquille, ★★★ à 12–13 % ; au niveau 2, le débutant obtient ★★★ dans 11 % des parties. Anciens seuils (lot 3) : 570/870, 290/540, 310/620, 550/780, 450/840, 290/670, 250/580, 410/660, 290/490, 680/950, 440/640, 420/660.)*

*(Lot 3, 2026-10-02 : seuils recalculés avec la variété active en Détente — tableau du village, cadeau de saison, charrette, défis, colporteur —, qui augmente le revenu de l'année du joueur tranquille d'environ 8,5 % et son argent final médian d'environ 55 % ; même règle, `node tools/simulate.js --stars` (200 parties par niveau) : chaque niveau donne ★★ ou mieux à 49–51 % des parties du joueur tranquille et ★★★ à 11–13 %. Au niveau 2, ★★★ = 540 (au lieu de 530) pour qu'il reste rare pour le débutant (≈ 16 %). Anciens seuils (lot 2) : 410/650, 180/470, 230/450, 420/590, 240/510, 180/470, 140/380, 260/530, 170/340, 570/780, 260/440, 290/560. Voir § 16.10.)*

*(Lot 2, 2026-10-02 : seuils relevés pour tenir compte des surprises — qualité, géants, fée, coffres, vœux —, actives par défaut en Détente, qui augmentent l'argent final médian du joueur tranquille de ~30 % ; même règle, recalculée avec elles. Anciens seuils : 300/490, 130/420, 150/360, 320/510, 180/380, 150/360, 90/310, 190/380, 100/250, 440/620, 200/360, 190/420. Au niveau 2, ★★★ passe à 470 pour qu'il reste rare pour le novice (≈ 16 %, comme avant). Voir § 15.)*

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


---

# 15. Lot 2 — surprises (toucher & surprises, 2026-10-02)

Synthèse : `docs/analyse/0-SYNTHESE.md`, points B2 à B6 et principe F1 (« machines et salariés aident sans
remplacer »). Contrat de code : `docs/ARCHITECTURE.md`, « Lot 2 — contrats » ; nombres : `src/data/surprises.js`.

**Règle d'or : tout est positif et rare.** Aucune surprise ne fait perdre une culture, un animal ou une pièce ; rien
ne presse (pas de compte à rebours stressant : les champignons restent quelques jours, le vœu attend qu'on le fasse).

**Activation** : par défaut en **Détente** et en **Carrière** ; jamais par défaut en **Classique** (le mode Classique se
joue exactement comme avant : test de parité des niveaux 1 à 8). Les tirages passent par trois flux aléatoires
nouveaux (qualité, surprises, ciel) : météo, marché, maladie et événements de carrière ne changent pas.

## 15.1 Récoltes de qualité (B2)

Chaque récolte tire sa qualité : **normale**, **belle** (× 1,5) ou **dorée** (× 2). La prime est payée tout de suite,
même si la récolte part à l'atelier, au grenier ou à une commande.

| Chances (cumulées) | belle | dorée |
|---|---|---|
| base | 2 % | 0,4 % |
| arrosée chaque jour où elle en avait besoin, depuis le semis (arbres : toujours) | + 1,5 % | + 0,4 % |
| une ruche dans la ferme | + 1 % | + 0,3 % |
| sol reposé : culture différente de la dernière récoltée sur cette parcelle | + 1 % | + 0,3 % |
| bonus permanent « Main verte » | + 1 % | + 0,3 % |
| vœu « main chanceuse » (3 jours) | × 2 | × 2 |

Au mieux (tous les soins) : belle 6,5 %, dorée 1,7 %. **La dorée n'existe que pour une récolte faite à la main** :
en carrière, salariés et machines récoltent au plus « belle » (principe F1). La fiche de la parcelle montre les
chances de la prochaine récolte à la main et les soins remplis. Les belles et dorées sont comptées par culture
(album du lot 4).

## 15.2 Légumes géants (B3)

Un carré 2 × 2 de la **même culture** (pas un arbre), **semée le même jour (à un jour près)**, **toute mûre** et
**arrosée le jour où elle a mûri** peut, à chaque aube, fusionner en un légume géant (**6 %** par aube, un carré au plus
par aube). Le géant occupe les 4 parcelles et vaut **6 fois** une parcelle (au lieu de 4) ; il ne pourrit pas ; il se
récolte **à la main**, en une fois, avec une grande fête. En carrière, salariés et machines le laissent **3 jours** au
joueur ; ensuite ils peuvent le récolter, sans la prime (4 fois leur valeur d'une parcelle) : un champ tenu par les
machines n'est jamais bloqué. De même, un salarié ou une machine qui sème sur des champignons les ramasse pour vous. Le carré
est cherché dans la grille du cœur (niveaux : grille du champ ; carrière : les 4 colonnes de chaque champ).

## 15.3 Surprises de l'aube (B4)

À chaque aube, à partir du 5e jour et au plus une tous les 3 jours, **6 %** de chances qu'une surprise arrive
(≈ une toutes les deux semaines de jeu), tirée parmi celles qui sont possibles :

| Surprise | Poids | Effet |
|---|---|---|
| La fée des cultures | 2 | mûrit d'un coup les cultures d'un carré 3 × 3 (celui qui en contient le plus) |
| Un vieux coffre | 3 | 15 à 30 pièces (carrière : + 15 × rang), ou 3 à 6 écus (35 %) |
| Un cercle de fées | 2 | champignons rares sur une parcelle vide : 1,5 × le prix de la culture la plus chère de la saison (au moins 25), 4 jours pour les cueillir |
| Un renard s'installe | 2 | carrière : plus aucun corbeau jusqu'à la fin de la saison |
| Un hérisson | 2 | niveaux où l'on peut pourrir : aucune pourriture pendant 6 jours |
| Une chouette sculptée | 1 | une fois par partie : décor « Chouette sculptée » débloqué (5 écus s'il est déjà à vous) |

## 15.4 Météos spéciales (B5)

Tirées en même temps que la prévision de demain (elles se voient **la veille**), sur une météo de base :

| Météo spéciale | Sur | Saisons | Chance | Effet |
|---|---|---|---|---|
| Pluie chaude | pluie | printemps → automne | 6 % | la pluie arrose, et la pousse du jour × 1,5 |
| Brouillard | nuageux | printemps, automne | 8 % | 2 à 4 parcelles vides se couvrent de champignons (0,25 × le prix de la culture la plus chère, au moins 5 ; 2 jours) |
| Étoiles filantes | soleil, nuageux | été → hiver | 3 % | le lendemain matin, un vœu parmi 3 : une bourse (20 pièces ; carrière + 15 × rang), un jour de pousse pour toutes les cultures, la main chanceuse (3 jours), une ondée (tout est arrosé) |
| Heure dorée | soleil | printemps → automne | 4 % | les récoltes (et le grenier en carrière) se vendent 20 % plus cher ce jour-là |
| Arc-en-ciel | soleil, nuageux, après la pluie | printemps → automne | 10 % | la pousse du jour + 10 % (niveaux ; en carrière c'est l'événement « arc-en-ciel » déjà existant, montré de la même façon) |

## 15.5 Trouvailles au défrichage (B6, carrière)

À l'achat d'un terrain, 1 trouvaille (2 dans 40 % des cas), tirées sans remise :

| Trouvaille | Poids | Effet |
|---|---|---|
| Un vieux coffre | 3 | comme le coffre de l'aube |
| Un pot de pièces | 3 | 30 à 60 pièces + 20 par terrain déjà acheté |
| Un bocal de graines anciennes | 3 | une graine ancienne (culture au hasard) gardée pour « La Vallée vivante » (`state.career.heirlooms`) |
| Un vieux puits | 2 | une fois : les cultures de ce terrain sont arrosées chaque matin |
| Une petite statue | 2 | une fois : décor « Petite statue » débloqué (5 écus s'il est déjà à vous) |
| Un agneau perdu | 2 | une fois : un mouton offert (s'il y a de la place à la bergerie ; sinon une poule, sinon 30 pièces) |

## 15.6 Équilibre (simulation)

Cible : les surprises ajoutent **au plus ~8 %** au revenu de l'année du joueur tranquille, sans changer les victoires ni le
rythme des rangs. Commandes : `node tools/simulate.js --compare-surprises [--strategy casual]` et
`node tools/simulate-career.js --compare-surprises` (même graine, sans → avec).

### Niveaux (Détente, 200 parties par niveau et par stratégie)

| # | casual : revenu (sans → avec) | casual : ★★★ (seuils du lot 2) | novice : revenu | optimal : revenu |
|---|---|---|---|---|
| 1 | 1 751 → 1 889 (+7,9 %) | 13 % | +4,3 % | +8,9 % |
| 2 | 1 744 → 1 913 (+9,7 %) | 6 % | +4,2 % | +10,3 % |
| 3 | 1 819 → 1 991 (+9,5 %) | 12 % | +3,3 % | +8,3 % |
| 4 | 1 503 → 1 598 (+6,3 %) | 13 % | +3,6 % | +6,3 % |
| 5 | 2 485 → 2 657 (+6,9 %) | 14 % | +5,1 % | +9,2 % |
| 6 | 1 900 → 2 070 (+8,9 %) | 12 % | +3,9 % | +8,5 % |
| 7 | 2 314 → 2 438 (+5,4 %) | 12 % | +2,9 % | +1,1 % |
| 8 | 2 020 → 2 153 (+6,6 %) | 11 % | +4,0 % | +10,6 % |
| 9 | 1 504 → 1 603 (+6,6 %) | 12 % | +3,6 % | +7,2 % |
| 10 | 2 046 → 2 168 (+6,0 %) | 9 % | +3,8 % | +11,1 % |
| 11 | 1 836 → 1 910 (+4,0 %) | 11 % | +3,3 % | +7,5 % |
| 12 | 2 188 → 2 348 (+7,3 %) | 12 % | +2,2 % | +14,9 % |
| **moyenne** | **+7,1 %** | ≈ 12 % (avant le lot 2 : 12 %) | **+3,7 %** | **+8,7 %** |

Par partie (casual, niveau 1) : ~2,4 belles, ~0,6 dorée, 0,15 géant, 1,2 surprise de l'aube, 1,5 météo spéciale ;
gain moyen : qualité ~46 pièces, géants ~23 (dont la prime : un tiers), surprises ~16. Le joueur appliqué (optimal)
arrose tout et gagne un peu plus (soins → plus de belles et dorées) : c'est voulu.

Victoires : inchangées ou meilleures (casual 92 → 95 % au niveau 7, novice 88 → 94 %) ; toutes les cibles du § 13.6
tiennent. L'argent final médian du joueur tranquille monte de ~30 % (l'argent final est ce qui reste après tout le
reste : 7 % de revenu en plus pèsent beaucoup sur lui) : **seuils d'étoiles de la Détente relevés** (§ 13.3) selon la même
règle qu'avant (★★ ≈ argent médian du joueur tranquille : 45 à 51 % l'obtiennent ; ★★★ ≈ ses 12 % meilleures parties).
Le mode Classique ne change pas (pas de surprises, mêmes seuils, test de parité).

### Carrière (Détente, saisons de 7 jours, 60 carrières × 10 ans)

| Robot | Revenu des 10 ans | Années 1 à 3 | Rang médian par année (sans → avec) | Domaine (médiane) |
|---|---|---|---|---|
| casual | **+5,0 %** | +5,5 % | identique, sauf an 8 : 5 → 6 | an 9 → an 8 |
| novice | +6,2 % | +20 % (trouvailles : grosses au regard d'un petit revenu) | identique, sauf an 5 : 3 → 4 | jamais → jamais |
| optimal | +4,6 % | +6,3 % | identique, sauf an 2 : 3 → 4 | an 6 → an 6 |

Aucune faillite, rythme des rangs inchangé à un an près. Un premier réglage bloquait des champs tenus par les machines
(géant jamais récolté, champignons jamais cueillis : revenu −3 %) : d'où le délai de 3 jours du géant et la cueillette
par les salariés et machines qui sèment (§ 15.2).

---

# 16. Lot 3 — Variété (conception, 2026-10-02)

Synthèse : `docs/analyse/0-SYNTHESE.md`, points C1, C2, C3, C4, C5 et C7 (feuille de route, lot 3 ; décision de
l'utilisateur). Contrat de code : `docs/ARCHITECTURE.md`, « Lot 3 — contrats ». Nombres de référence (à régler par la
simulation, la version qui fait foi vivra dans `src/data/variety.js`, `src/data/career/themes.js` et
`src/data/crops.js` pour les graines rares).

**But** : casser la routine « récolter, semer partout la culture au meilleur +X/jour, arroser » en donnant chaque jour
une petite question différente au joueur (*quoi semer pour qui ? quel cadeau garder ? quel défi tenter ? que
rapporter du colporteur ?*), dans les deux modes, sans ajouter de stress.

## 16.0 Règles d'or du lot

1. **Aucun stress** : aucune échéance qui fait perdre quelque chose, aucun refus pénalisé, rien n'est jamais perdu (ce qui
   a été livré est toujours payé, au moins au prix normal), aucune série à entretenir, aucune nouvelle monnaie (pièces de
   la partie et écus décoratifs seulement). Ce qui a une date (charrette, colporteur, fête) est **annoncé à l'avance** et
   **revient** : le rater n'a pas d'importance.
2. **Toujours faisable** : tout ce qui est demandé est produisible **cette saison** avec la ferme telle qu'elle est (un
   seul générateur, § 16.1, sert au tableau, à la charrette et aux défis).
3. **Le joueur au centre** : une commande ou une caisse se remplit par **une action du joueur** — sa récolte à la main,
   ou (carrière) un toucher « Livrer / Charger depuis le grenier ». Salariés et machines peuvent remplir le grenier, mais
   ne livrent jamais à sa place (principe F1 « aider sans remplacer »).
4. **Téléphone d'abord** : tout passe par des feuilles du bas, des cartes pleine largeur, des boutons ≥ 48 px, des
   textes ≥ 14 px et **peu de mots** (une phrase par client, une ligne par effet).
5. **Mode Classique des niveaux strictement inchangé** (test de parité) : tout le lot y est **désactivé par défaut**,
   comme les surprises du lot 2. **Détente** et **Carrière** : activé.
6. **Équilibre** : le lot entier ajoute **au plus ~10 %** au revenu de l'année du joueur tranquille (§ 16.9), et les
   seuils d'étoiles de la Détente sont recalculés selon la règle du § 13.3.

## 16.1 Le générateur de demandes « faisables cette saison » (commun à C1, C3, C4)

Une seule fonction décide de ce que le village peut demander. Une culture est **faisable** si elle est dans la liste
des cultures de la partie (niveau : `level.crops` ; carrière : cultures du rang) — **jamais une graine rare** (§ 16.7) —
et si au moins une de ces conditions est vraie :

| Raison | Condition |
|---|---|
| `growing` | elle pousse déjà sur une parcelle (mûre ou non, pas sur une parcelle d'un géant) et ne gèlera pas avant d'être mûre |
| `stock` | (carrière) il en reste au grenier |
| `sowable` | elle se sème aujourd'hui, et ses jours de pousse (arrosée) tiennent dans l'**horizon** (ci-dessous) sans geler |
| `tree` | arbre fruitier adulte possédé, en saison de fruits, et une récolte de fruits tient dans l'horizon (ou est déjà mûre) |

Horizon : **tableau** = jours restants dans la saison, aujourd'hui compris, au moins 3 ; **charrette** = durée de la
saison − 1 (tirée le 1er jour) ; **défis** : durée de la saison — le nombre de cultures distinctes faisables plafonne
« Potager varié » (cultures qu'on peut récolter) et « Semeur curieux » (cultures qui se sèment), § 16.5.

**Exclusions** (si au moins une autre culture reste possible) : la culture de la quête de Joseph en cours (carrière : pas
de concurrence pour les récoltes) ; une culture qu'un atelier **allumé** du joueur transforme (l'atelier passe avant,
§ 16.2.4) ; une culture déjà demandée ailleurs sur le tableau ; pour le tableau, une culture déjà dans une caisse de la
charrette en cours.

**Poids** du tirage : 1 ; **× 3 si elle ne pousse pas encore** (tableau : on pousse à diversifier) ; × 2 culture vedette de
l'année (carrière, § 16.6) ; × 2 culture préférée du client tiré (tableau) ; × 0,5 si elle était déjà demandée hier.

Si aucune culture n'est faisable (dernier jour d'hiver sans rien qui pousse…), la place reste vide avec « Pas de demande
aujourd'hui : revenez demain ! ».

## 16.2 C1 — Le tableau du village

Un **panneau en bois** près du portail de la ferme (niveaux : au bord du chemin, sous le champ ; carrière : bande de la
maison, près de la boîte aux lettres) porte **3 commandes** de villageois. Il est toujours visible ; on le touche pour
ouvrir sa feuille. C'est le remplaçant des « visiteurs acheteurs » de la carrière (§ 16.8).

### 16.2.1 Une commande

- Un **client** (§ 16.2.6), une phrase de lui, et **une ligne** : *N × une culture* (carrière, rang ≥ 3 : **30 %** des
  commandes ont **deux lignes**, deux cultures différentes, comme un petit panier).
- Une **prime** : `taux` tiré parmi **×1,2 (poids 4), ×1,3 (3), ×1,4 (2), ×1,5 (1)** (moyenne ×1,3) ; commande à deux
  lignes : +0,1 (au plus ×1,5) ; carte « Le crieur du village » : +0,1 (au plus ×1,6).
- **Taille** N (une ligne) selon le prix de vente de base de la culture :

| Culture | Niveaux | Carrière |
|---|---|---|
| bon marché (vente < 20 : carotte, navet, blé, pomme de terre) | 3 à 5 | 3 à 5 + ⌊(rang − 1) / 2⌋ |
| moyenne (20 à 39 : chou, tomate, tournesol, fraise, courgette, pomme) | 2 à 4 | 2 à 4 + ⌊(rang − 1) / 2⌋ |
| chère (≥ 40 : maïs, citrouille) | 2 à 3 | 2 à 3 + ⌊(rang − 1) / 3⌋ |

  Plafond : ⌊parcelles de champ ouvertes / 3⌋, au moins 2 ; fruits : au plus 2 paniers par arbre adulte. Ligne
  secondaire d'une commande à deux lignes : taille de sa catégorie − 1 (au moins 2).

### 16.2.2 Remplir et livrer

- **À la récolte à la main** : une récolte d'une culture demandée part à la commande (texte flottant « → Lili », petit
  bruit de papier). Elle est **payée tout de suite au prix normal** (comme si elle était vendue : étal, cours, prime
  « à la main », qualité du lot 2 comprises) : on ne perd jamais de trésorerie à remplir une commande.
- La **prime** est versée quand la commande est complète : `prime = arrondi(Σ valeur de base × (taux − 1))`, où la
  valeur de base d'une unité = prix de vente de la culture × prix des récoltes du mode (× 1,25 en Détente) × baisse du
  niveau 9 (× 0,75), **sans** étal, cours, fête, prime « à la main » ni qualité (la carte affiche la prime exacte :
  « +16 »). Exemple Détente : 5 carottes à ×1,3 → 5 × 12,5 × 0,3 = **+19**.
- Commande complète → **livrée** : le client remercie (sa phrase de merci), pluie de pièces de la prime vers le compteur,
  coche verte sur la feuille du panneau, la place reste libre jusqu'à l'aube suivante.
- **Carrière, grenier** : bouton « **Livrer depuis le grenier** » sur la commande (si le stock en a) : les unités sont
  vendues au prix du jour du grenier et comptées ; même règle de prime. **Les récoltes des salariés et des machines ne
  partent jamais à une commande** (elles vont au grenier ou à la vente, comme avant) : c'est le joueur qui livre.
- **Ordre de priorité d'une récolte à la main** : (1) quête de Joseph acceptée (carrière, inchangé), (2) commandes du
  tableau (la plus avancée d'abord, puis la plus ancienne), (3) charrette (§ 16.4), (4) atelier allumé avec une place libre,
  (5) grenier (carrière, selon la mise en réserve), (6) vente. Une récolte comptée pour (2) ou (3) est vendue tout de suite
  (elle ne va ni à l'atelier ni au grenier).
- Les récoltes comptées restent des récoltes (statistiques, succès, objectifs de rang, comice, concours du niveau 12).

### 16.2.3 Le rythme (sans échéance)

- **À chaque aube**, les commandes **non gardées et pas commencées** sont remplacées par de nouvelles (« renouvelées à
  l'aube »), et les places vides se remplissent (3 au plus).
- **Garder** (punaise, bouton « Garder ») : une commande gardée ne part plus, **sans limite de temps**, jusqu'à ce qu'elle
  soit livrée ou qu'on la retire. Une commande **commencée** (au moins une unité donnée) est gardée d'office. On peut
  garder les 3. Utile quand on sème exprès pour elle.
- **Gardée d'office au semis** *(QA, 2026-10-02)* : semer **à la main** la culture d'une commande non gardée la garde
  aussitôt (on sème pour elle : elle ne doit pas disparaître à l'aube avant la récolte). Indice discret : étiquette
  « Gardée : Lili » au-dessus de la parcelle, punaise rouge sur le panneau, mention « Gardée d'office : vous avez semé
  pour elle. » dans la feuille. Le joueur peut ôter la punaise ou la refuser (✕), sans pénalité. Les semis des salariés,
  des machines et de Joseph ne gardent rien.
- **Autres demandes** (bouton ↻ en bas de la feuille) : **une fois par jour, gratuit** : remplace tout de suite toutes les
  commandes non gardées et pas commencées.
- **Pas pour moi** (✕ sur chaque commande) : la commande part, **sans aucune pénalité** ; si elle était commencée, le
  client paie quand même la prime **des unités déjà données** (« Merci pour ces 2 carottes ! +7 »). La place se
  remplit à l'aube suivante.
- **Changement de saison** : une commande gardée qui n'est plus faisable (§ 16.1 : la culture ne se sème plus, rien ne
  pousse, rien au grenier) est retirée gentiment ; commencée, le client paie la prime des unités données (« La saison
  est passée : je prends ce que vous avez, merci ! »).
- **Début** : niveaux 2 à 12 et carrière, dès le 1er jour ; **niveau 1 : à l'aube du 5ᵉ jour** (après les premiers gestes
  du tutoriel), avec le conseil `variety.board`.

### 16.2.4 Cas limites

- Atelier : une culture qu'un atelier allumé transforme n'est pas proposée (si une autre culture est possible). Si
  l'atelier est allumé **après**, la commande ne se remplit qu'avec les récoltes que l'atelier ne prend pas (atelier plein) ;
  la fiche de la commande l'écrit (« L'atelier passe d'abord »).
- Géant (lot 2) : un légume géant récolté compte pour **4 unités** de sa culture (le surplus, au-delà de ce qui manque,
  va à la charrette puis à la vente) ; sa prime de géant reste payée.
- Champignons, pommes de terre sans arrosage, serre (carrière) : rien de spécial (une récolte est une récolte).
- Prêt de Joseph (Détente) : la prime est une vente comme une autre (sa part de remboursement s'applique).
- Fin de partie (niveaux) : rien n'est dû ; le panneau disparaît avec la victoire.
- Faillite (Classique avec la variété activée par option) : sans objet.

### 16.2.5 Interface

- Feuille « **Le tableau du village** » (haute) : 3 cartes pleine largeur (≥ 96 px) : portrait 48 px, prénom et métier,
  phrase (≤ 45 caractères), ligne « [icône] 2 / 5 carottes », prime « +19 » (pièce), boutons « 📌 Garder » (bascule) et
  « ✕ » (48 × 48, libellé lu « Pas pour moi »). Commande livrable depuis le grenier : « Livrer depuis le grenier (3) ».
  En bas : « ↻ Autres demandes » (grisé « Demain » après usage). Place vide : « Nouvelle demande demain matin ».
- Scène : 1 à 3 petites feuilles épinglées sur le panneau (punaise rouge si gardée), une coche quand une est livrée.
- Ligne « À faire maintenant » (lot 1) : « Lili attend 2 carottes » (la commande la plus avancée) ; résumé du matin :
  « 2 nouvelles commandes au tableau » ; fiche d'une parcelle mûre : « À la récolte : → Lili (3 / 5) ».
- Feuille des graines : badge « Commande » sur les cultures demandées (gardées ou non).

### 16.2.6 Les clients du village

Douze villageois (portrait 32 × 32 chacun). Préférées : poids × 2 au tirage (§ 16.1).

| id | Client | Préférées | Phrase de commande | Merci |
|---|---|---|---|---|
| `rose` | Mme Rose, la fleuriste | tournesol, fraise | « Pour égayer mes bouquets du dimanche. » | « Que c'est joli ! Merci ! » |
| `paulo` | Paulo, le boulanger | blé, pomme, fraise | « Pour mes tartes de demain matin. » | « Ça sent déjà bon ! » |
| `lili` | La petite Lili | carotte, navet | « C'est pour le goûter de mon lapin Caramel ! » | « Caramel te dit merci ! » |
| `garnier` | M. Garnier, l'instituteur | pomme de terre, chou, navet | « Pour la cantine de l'école. » | « Les enfants vont se régaler. » |
| `chevalier` | Mme Chevalier, l'aubergiste | tomate, citrouille, chou | « Pour la soupe du soir à l'auberge. » | « Mes clients en redemanderont ! » |
| `fabre` | Le père Fabre, pêcheur | courgette, tomate, maïs | « Pour mon pique-nique au bord de l'étang. » | « Ça mord mieux le ventre plein. » |
| `perrin` | Mlle Perrin, la musicienne | fraise, pomme | « Une petite douceur avant le concert. » | « Je jouerai un air pour vous ! » |
| `maire` | M. le maire | maïs, citrouille, blé | « Pour le buffet de la mairie. » | « Au nom du village, merci ! » |
| `odette` | Mamie Odette | fraise, pomme, chou | « Pour mes bocaux de l'hiver. » | « Passe goûter quand tu veux. » |
| `leon` | Léon, le facteur | carotte, pomme, blé | « Ça me donnera des jambes pour ma tournée. » | « Je file, merci ! » |
| `morel` | Mme Morel, la couturière | tournesol, navet | « Pour teindre mes laines, croyez-le ou non. » | « Mes pelotes seront superbes. » |
| `twins` | Zoé et Bastien, les jumeaux | maïs, citrouille, carotte | « Pour notre cabane secrète (chut !). » | « Promis, on ne dira rien ! » |

Client tiré : un client qui n'est pas déjà sur le tableau, au hasard (flux `orders`), puis sa culture (§ 16.1). Joseph
n'est jamais sur le tableau (il a ses quêtes, § 16.8).

## 16.3 C2 — Un cadeau pour la saison (choix d'une carte)

À la **fin de chaque saison**, deux **cartes gratuites** sont proposées ; on en **garde une**. Cela transforme le bilan en
décision et rend chaque partie d'un niveau différente.

- **Quand** : niveaux, le soir du dernier jour du printemps, de l'été et de l'automne, **après le fermage payé** (3 par
  année ; pas après l'hiver : c'est la victoire). Carrière : le soir du dernier jour de **chaque** saison (4 par an).
- **Effet** : pour « la saison suivante » (de l'aube suivante au soir de son dernier jour), ou tout de suite pour les
  cartes immédiates.
- **Choix** : dans la fenêtre de fin de saison (page « Un cadeau pour la saison »), deux grandes cartes ; toucher une
  carte = la garder (animation, son). Fermer sans choisir : le choix **attend** (pastille sur l'onglet Bilan / le Carnet,
  section « Cadeau de la saison ») pendant toute la saison ; une carte « saison » choisie en retard ne dure que jusqu'à la
  fin de cette saison. Pas choisie à la fin de saison suivante : elle est simplement remplacée par la nouvelle paire (sans
  message).
- **Tirage** (flux `variety`) : 2 cartes **différentes** parmi les cartes possibles (conditions), selon leur poids ;
  jamais exactement la même paire que la fois précédente.

| id | Carte | Effet (niveaux) | Carrière | Condition | Poids |
|---|---|---|---|---|---|
| `purse` | La bourse du village | **+20 pièces + 5 par saison déjà jouée**, tout de suite (25 / 30 / 35) | **+30 + 20 × rang** | — | 3 |
| `seedFair` | Foire aux graines | Graines **à moitié prix** les **3 premiers jours** de la saison suivante | idem (semoir compris) | — | 3 |
| `fertilizer` | Sac d'engrais | Pousse **+10 %** toute la saison suivante (cultures et arbres) | idem | — | 3 |
| `hen` | Une poule voyageuse | **+4 pièces chaque matin** de la saison suivante (une poule se promène dans la cour) | **Deux poules offertes** (au poulailler) | carrière : 2 places libres au poulailler | 2 |
| `watering` | L'arrosoir magique | Chaque matin de la saison suivante, **4** parcelles qui ont soif sont arrosées (gratuit, après l'arrosage automatique) | **6** parcelles | pas au niveau 8 (sans arrosage automatique) | 2 |
| `clover` | Trèfle à quatre feuilles | Chances de récolte **belle et dorée × 2** toute la saison suivante (cumulable avec le vœu : × 4 au plus) | idem | surprises actives | 2 |
| `poster` | Une affiche au marché | Récoltes vendues **+5 %** toute la saison suivante (pas les produits) | idem | — | 2 |
| `landlord` | Le geste du propriétaire | **Prochain fermage −20 %** (arrondi) | **Ristourne de la coopérative** : prochaines charges de saison −20 % | — | 2 |
| `bees` | Un essaim d'abeilles | **Une ruche offerte**, tout de suite | idem (une ruche posée) | la ruche est proposée, pas au maximum (carrière : rang et place) | 1 |
| `crier` | Le crieur du village | Primes du tableau **+0,1** (× 1,3 → × 1,4) toute la saison suivante | idem | tableau actif | 2 |
| `cartHorse` | Un cheval de renfort | **Prime de la prochaine charrette × 2** | idem | une charrette viendra la saison suivante | 2 |
| `clearing` | Coup de main au défrichage | **Prochaine parcelle achetée gratuite** | **Prochain aménagement de terrain −50 %** | le champ peut encore s'agrandir (carrière : un terrain en friche ou à acheter) | 1 |
| `seedBag` | Un sachet de graines rares | **4 graines rares** d'une culture rare de la saison suivante (§ 16.7), tout de suite | **8 graines** | — | 1 |
| `recipe` | La recette de saison | Produits transformés **+15 %** toute la saison suivante | idem | un atelier possédé | 1 |
| `hay` | Du foin parfumé | Revenus quotidiens des animaux **+15 %** toute la saison suivante (poules, vaches, chèvres ; pas la tonte) | production des abris +15 % | un animal possédé | 1 |
| `almanac` | L'almanach du berger | Météo d'**après-demain** affichée jusqu'à la fin de la partie | jusqu'à la fin de l'année | ni bonus « Almanach » ni almanach du colporteur | 1 |

Repères (niveau 1 Détente, joueur tranquille) : une carte vaut en moyenne **20 à 35 pièces** (bourse 25–35, foire ~20,
engrais ~25, poule 28, affiche ~20, propriétaire 12–26, essaim ~60, défrichage ~40) — soit 3 cartes ≈ 2 à 3 % du revenu
de l'année. Les cartes chères (essaim, défrichage) ont un poids de 1.

## 16.4 C3 — La charrette du marché

Une grosse commande **en caisses**, une fois par saison, qui pousse à **diversifier** le potager.

- **Arrivée** : à l'aube du **1er jour** de chaque saison (niveaux : les 4 saisons ; **niveau 1 : à partir de l'été** ;
  carrière : dès l'été de la 1re année, puis chaque saison, l'hiver seulement si une culture est faisable). Une charrette
  tirée par un âne se gare au bord du chemin, avec ses caisses vides.
- **Départ** : le **soir du dernier jour de la saison, avant le fermage** (carrière : avant les charges de saison) — sa
  prime aide à payer. L'heure est connue dès l'arrivée (« Part le soir du 7ᵉ jour »), sans compte à rebours.
- **Caisses** : **3** (niveau 4 et toute charrette d'hiver : **2** ; carrière : 3, **4 au rang ≥ 4**). Chaque caisse =
  **une culture faisable sur la saison** (§ 16.1, cultures différentes si possible) × **N unités** :
  - niveaux : N = arrondi(4 × parcelles ouvertes / 12 × durée de la saison / 7), entre 2 et 10 (niveau 1 : 4 ; niveau 4 :
    2 ; hiver de 14 jours du niveau 5 : 8) ;
  - carrière : N = arrondi((4 + 2 × (rang − 1)) × durée / 7), au plus la moitié des parcelles de champ ouvertes, au moins 2.
- **Remplir** : les récoltes **à la main** d'une culture d'une caisse non pleine y vont automatiquement, après les
  commandes du tableau (§ 16.2.2) : vendues tout de suite au prix normal, comptées dans la caisse (texte flottant
  « → charrette »). Carrière : « **Charger depuis le grenier** » sur chaque caisse (toucher du joueur ; unités vendues au
  prix du grenier). Jamais les récoltes des salariés ni des machines.
- **Paiement au départ** (même incomplète) : **prime = 10 %** de la valeur de base des unités chargées ; **toutes les
  caisses pleines** : **+10 %** de plus (20 % au total) **et 2 écus**. Carte « Un cheval de renfort » : prime × 2 (pas les
  écus). Valeur de base : comme au § 16.2.2. Exemple niveau 1, été : 3 caisses de 4 (tomates, maïs, tournesols) = 12 unités,
  valeur de base 47,5 × 4 + 62,5 × 4 + 40 × 4 = 600 → remplie à moitié (300 de valeur chargée) : +30 ; toute pleine : +120 et 2 écus.
- **Rien chargé** : la charrette repart sans rien dire de plus qu'un message doux (« La charrette repart. À la saison
  prochaine ! »).

Interface : toucher la charrette (scène) ou sa ligne dans le Bilan / l'Agenda → feuille « **La charrette du marché** » :
une rangée par caisse (icône de la culture 32 px, barre « 3 / 4 », coche si pleine ; carrière : bouton « Charger (2) »),
puis « Prime au départ : +30 · tout plein : +120 et 2 écus ». Scène : les caisses se posent devant la charrette et se
remplissent (sprite `crate.<culture>` quand pleine) ; au départ, la charrette s'en va sur le chemin (mouvements réduits :
elle disparaît en fondu). Fenêtre de fin de saison : ligne « La charrette : +30 (2 caisses sur 3) ».

## 16.5 C4 — Les défis de la saison

Trois **défis** sont proposés pour chaque saison ; on en **garde 1 ou 2**. Chacun a trois paliers : **bronze, argent,
or**. Rien ne se reporte d'une saison à l'autre (aucune série).

- **Proposition** : pour la 1re saison, à la création de la partie (niveau 1 : pas de défi au printemps, première
  proposition à la fin du printemps) ; ensuite, le soir du dernier jour de la saison précédente, dans la fenêtre de fin de
  saison (page « Les défis de l'été »). Carrière : dès l'été de la 1re année, puis chaque saison.
- **Choix** : toucher un défi = le garder (2 au plus) ; on peut changer d'avis à tout moment de la saison, tant que le
  défi n'a pas encore de médaille. On peut aussi choisir plus tard (Bilan / Carnet, section « Défis de la saison ») : **la
  progression compte depuis le 1er jour de la saison**, choisir tard ne coûte rien. Seuls les défis gardés donnent des
  médailles.
- **Médailles** : dès qu'un palier est atteint (pendant la saison), message doré « Médaille d'argent : Belle cueillette »
  et récompense immédiate ; les paliers se cumulent.

| Médaille | Niveaux | Carrière |
|---|---|---|
| bronze | **1 écu** | 1 écu |
| argent | **2 écus + 10 pièces** | 2 écus + 4 × rang pièces |
| or | **4 écus + 20 pièces** | 4 écus + 8 × rang pièces |

  Au mieux, deux ors par saison : 14 écus et 60 pièces (niveaux). Les médailles sont comptées (album du lot 4).
- **Tirage** (flux `variety`) : 3 défis **différents** parmi les possibles, selon leur poids, jamais exactement les mêmes
  trois que la saison précédente.

Cibles : `k` = (parcelles de champ ouvertes au début de la saison / 12) × (durée de la saison / 7), entre 0,5 et 4 ;
toute cible arrondie, au moins 1.

**Paliers toujours strictement croissants et atteignables** *(QA, 2026-10-02)* : avec peu de cultures faisables (niveau 2
au printemps : 3), « Semeur curieux » et « Potager varié » avaient des paliers 3 / 3 / 3 et les trois médailles tombaient
d'un coup au 2ᵉ jour. Règle, appliquée à tous les défis :
1. un palier égal ou inférieur au précédent est relevé d'une unité (arrondis des petits champs) ;
2. sous un **plafond** (cultures faisables récoltables pour « Potager varié », semables pour « Semeur curieux », nombre
   de caisses pour « La charrette pleine »), l'or descend au plafond, puis chaque palier au plus le suivant − 1 ;
3. si le bronze tombe alors sous son minimum (**2** pour les deux défis de cultures différentes — le 1er semis ne doit
   pas suffire —, 1 sinon), **le défi n'est pas proposé** (un autre est tiré à sa place).

Exemples : 4 cultures faisables → 2 / 3 / 4 ; 5 → 3 / 4 / 5 (semer) ; 3 ou moins → pas proposé ; charrette de 2 caisses
(niveau 4, hiver) → « La charrette pleine » pas proposée (1 / 2 / 2 auparavant).

| id | Défi | Mesure (depuis le 1er jour de la saison) | Bronze / argent / or | Condition | Poids |
|---|---|---|---|---|---|
| `harvests` | Belle cueillette | récoltes (toutes) | 12 / 20 / 30 × k | — | 3 |
| `sales` | Bon marché | pièces de ventes de récoltes (prime de qualité comprise) | 150 / 260 / 380 × k × prix des récoltes du mode | — | 3 |
| `variety` | Potager varié | cultures différentes récoltées | 3 / 4 / 6 (sous le plafond : règle ci-dessus) | ≥ 4 cultures faisables récoltables | 2 |
| `sowing` | Semeur curieux | cultures différentes semées | 4 / 5 / 6 (idem) | ≥ 4 cultures semables | 2 |
| `care` | Aux petits soins | récoltes « arrosée chaque jour où il le fallait » (soin du lot 2) | 3 / 6 / 10 × k | surprises actives | 2 |
| `quality` | La main verte | récoltes belles ou dorées | 1 / 2 / 4 × max(1, k) | surprises actives | 1 |
| `orders` | Ami du village | commandes du tableau livrées | 1 / 2 / 3 | tableau actif | 2 |
| `crates` | La charrette pleine | caisses de la charrette remplies | 1 / 2 / 3 | charrette d'au moins 3 caisses cette saison | 2 |
| `products` | Fait maison | produits transformés vendus | 2 / 4 / 6 (carrière : + rang) | un atelier possédé | 2 |
| `apples` | Paniers du verger | paniers de fruits récoltés | 1 / 2 / 4 × max(1, arbres adultes / 2) | arbre adulte, saison de fruits | 1 |
| `animals` | Basse-cour heureuse | pièces de revenus des animaux (niveaux) | 25 / 45 / 70 × durée / 7 | un animal qui rapporte | 1 |
| `collect` | La tournée des abris | ramassages d'abris faits par le joueur (carrière) | 5 / 9 / 14 × durée / 7 | carrière, un abri | 2 |

Interface : cartes de défi (≥ 72 px) avec icône, nom, phrase courte, trois pastilles de médaille et barre « 14 / 20 » ;
une bande « Défis » dans le Bilan (niveaux) et l'Agenda (carrière). Fenêtre de fin de saison : médailles obtenues.

## 16.6 C5 — Les années à thème (carrière)

À partir de la **2e année**, chaque année de carrière a un **thème** : une **vedette** (culture, fruit ou produit, vendue
**+25 %** toute l'année, et deux fois plus demandée par le tableau et la charrette), une **fête spéciale** (un jour du
calendrier en plus) et un **visiteur unique** (une fois dans l'année, un cadeau). Chaque thème est **au moins à moitié
positif** : trois avantages au moins, au plus une petite contrepartie, jamais une perte.

- **Tirage** : au bilan de l'année (flux `variety`), parmi les thèmes **possibles** au rang de la ferme, sans répétition
  tant que tous les thèmes possibles n'ont pas été vus (sac). Annoncé dans le bilan (« L'an prochain : l'année des
  abeilles ! »), puis bandeau au 1er jour de printemps. 1re année : « l'année de l'installation », sans thème.
- **Fête spéciale** : comme les fêtes du calendrier (bandeau la veille, décor, musique de fête), jamais le même jour
  qu'une autre fête ni que le colporteur (jours 5 et 6).
- **Visiteur unique** : il arrive le jour dit (petit personnage sur le chemin, offre dans le Carnet) et **attend la
  réponse jusqu'à la fin de la saison** ; son cadeau est gratuit.

| id | Thème | Rang | Vedette (+25 %) | Autres effets toute l'année | Fête spéciale | Visiteur unique (jour) → cadeau |
|---|---|---|---|---|---|---|
| `bees` | L'année des abeilles | 2 | tournesol | ruches : revenu **+50 %** | **Fête du miel** (été, j. 2) : ruches × 3 ce jour, récoltes +10 % | **Margot l'apicultrice** (printemps, j. 2) → une ruche posée (s'il y a la place), sinon 60 pièces |
| `cheese` | L'année du fromage | 3 | fromages (vache et chèvre) | lait : la fromagerie a **+1 place** dès le visiteur | **Foire aux fromages** (automne, j. 7) : produits × 1,5 ce jour | **Anselme le fromager** (été, j. 2) → +1 place à la fromagerie pour l'année (sans fromagerie : 80 pièces) |
| `tourism` | Le boom touristique | 2 | fraise | touristes : **2 fois plus souvent**, **+50 %** par passage ; chambre d'hôte +25 % | **Nuit des lampions** (été, j. 7) : chambre d'hôte × 2, touristes garantis (3 passages) | **Une journaliste de « Campagne & Jardins »** (printemps, j. 7) → 10 écus et le décor « Vu dans le magazine » |
| `giants` | L'année des géants | 3 | citrouille | chance des légumes géants **× 2** (6 → 12 %) ; graines de citrouille −20 % | **Concours du plus gros légume** (automne, j. 4) : récoltes de citrouille × 1,5 ce jour, géants récoltés ce jour + 50 % | **Gaspard, jardinier champion** (été, j. 2) → 6 graines de citrouille offertes (semis gratuits) |
| `frogs` | L'année des grenouilles | 1 | chou | les jours nuageux, **30 %** de chances d'une petite averse à l'aube (tout est arrosé) ; corbeaux 2 fois plus rares | **Bal des grenouilles** (printemps, j. 7) : tout est arrosé, récoltes +10 % | **Firmin le vieux pêcheur** (automne, j. 3) → une canne : poissons +50 % toute l'année (sans mare : 40 pièces) — *contrepartie : l'heure dorée (lot 2) est 2 fois plus rare* |
| `orchard` | L'année des vergers | 2 | pomme | les fruits des arbres mûrissent **20 % plus vite** | **Fête de la pomme** (automne, j. 7) : paniers de fruits et jus × 1,5 ce jour | **Mathis le pépiniériste** (printemps, j. 7) → un pommier **adulte** planté sur une parcelle libre du verger (sinon 80 pièces) |
| `bread` | L'année du pain | 1 | blé | farine et pain **+20 %** ; graines de blé −20 % | **Fête du pain** (été, j. 7) : blé × 1,25, produits du moulin × 1,5 ce jour | **Jeanne la meunière** (printemps, j. 2) → 10 semis de blé gratuits et 40 pièces |
| `markets` | L'année des grands marchés | 2 | tomate | cours du marché **plus vifs** : × 0,7 à × 1,45 au lieu de × 0,8 à × 1,3 — *contrepartie : des jours bas plus bas* | **Grand marché** (printemps, j. 7) : toutes les ventes +20 % ce jour | **Un grossiste de la ville** (automne, j. 3) → rachète le grenier **+30 %** au cours du jour (une fois, quand on veut avant la fin de la saison) |
| `lights` | L'année des lumières | 1 | navet | produits transformés vendus en hiver **+15 %** ; employés joyeux toute la semaine de la fête | **Fête des lumières** (hiver, j. 2) : produits × 1,3 ce jour, lampions | **Le colporteur du Nord** (hiver, j. 7) → 8 graines rares de poireau et 5 écus |

Les effets « toute l'année » durent du 1er jour de printemps au soir du dernier jour d'hiver. La vedette compte pour les
récoltes, le grenier et (si c'est un produit) les ventes de produits. Une ferme sans le bâtiment d'un effet (pas de
ruche…) profite quand même de la vedette, de la fête et du visiteur.

## 16.7 C7 — Le jour du colporteur

**Basile le colporteur** passe à date fixe avec sa roulotte : on attend « le jour du colporteur ».

- **Quand** : le **5e jour de chaque saison** (saison de moins de 6 jours : le jour 4), il reste **deux jours** (il repart
  le soir du 6e jour). Annoncé la veille à l'aube (« Demain, Basile le colporteur passe à la ferme ») et visible dans le
  calendrier. Niveaux : chaque saison, **sauf le printemps du niveau 1** ; carrière : chaque saison dès l'été de la 1re
  année. Il remplace le marchand ambulant au hasard de la carrière (§ 16.8).
- **L'étal** : tiré à l'arrivée (flux `variety`) : **toujours un sachet de graines rares** (s'il y en a une de saison) +
  **2 autres objets** (carrière, rang ≥ 3 : 3), parmi ceux qui sont possibles ; chaque objet se vend **une fois** par
  passage ; un objet unique déjà possédé n'est plus proposé.
- On achète d'un toucher (prix en pièces, confirmation seulement au-delà de la moitié de l'argent).

| id | Objet | Niveaux : prix · effet | Carrière : prix · effet | Condition | Poids |
|---|---|---|---|---|---|
| `seeds.pea` / `seeds.melon` / `seeds.leek` | Sachet de graines rares | **30 / 90 / 50** · 6 semis de petits pois / melon / poireau (graine comprise) | 60 / 180 / 100 · 12 semis | culture de saison | (toujours 1) |
| `fertilizer` | Engrais du colporteur | **35** · tout le champ : +0,25 jour de pousse par aube pendant 3 aubes | **150** · un champ (règle de l'ancien marchand) | — | 3 |
| `usedCoop` | Poulailler d'occasion | 70 % du prix du prochain poulailler · posé tout de suite | — (carrière : `hens`) | poulailler proposé, pas au max | 2 |
| `hens` | Deux poules | — | **40** · deux poules au poulailler | carrière, 2 places | 2 |
| `usedHive` | Ruche d'occasion | 70 % du prix de la prochaine ruche | **40** | ruche proposée, pas au max (carrière : place) | 2 |
| `copperCan` | Arrosoir de cuivre (unique) | **60** · chaque matin, 3 parcelles qui ont soif sont arrosées, jusqu'à la fin de la partie | **300** · 4 parcelles, pour toujours | pas au niveau 8 | 2 |
| `almanac` | Almanach de poche (unique) | **20** · météo d'après-demain jusqu'à la fin de la partie | **80** · pour toujours | pas de bonus « Almanach » | 1 |
| `horseshoe` | Fer à cheval porte-bonheur (unique) | **45** · belle +1 point, dorée +0,3 point jusqu'à la fin de la partie | **250** · pour toujours | surprises actives | 1 |
| `lantern` | Lanterne du colporteur (décor) | **30** · décor `lantern.peddler` débloqué (5 écus s'il est déjà à vous) | **60** | — | 1 |
| `weathervane` | Girouette au coq (décor) | **40** · décor `weathervane.rooster` | **80** | — | 1 |
| `heirloom` | Bocal de graines anciennes | — | **120** · une graine ancienne (`state.career.heirlooms`, pour « La Vallée vivante ») | carrière | 1 |

### Les graines rares (trois cultures nouvelles)

Elles n'existent **que** par le colporteur (et les cartes « Sachet de graines rares », le visiteur de l'année des
lumières) : jamais dans les listes des niveaux, jamais dans les rangs de la carrière, jamais semées par le semoir ni les
jardiniers (aider sans remplacer), jamais demandées par le tableau ni la charrette. Un semis consomme une graine du
sachet, **sans payer** (le sachet comprend les graines).

| Culture | id | Saisons | Pousse | Graine (repère) | Vente | Gel | Profit / jour (arrosée) |
|---|---|---|---|---|---|---|---|
| Petits pois | `pea` | printemps | 3 j | 5 | 17 | gèle | 4,0 (carotte 3,0) |
| Melon | `melon` | été | 6 j | 15 | 64 | gèle | 8,2 (maïs 5,8) |
| Poireau | `leek` | automne, hiver | 5 j | 8 | 27 | **résiste** | 3,8 (chou 3,0) |

Rares mais pas écrasantes : un sachet de 6 semis rapporte 15 à 60 pièces de plus que la culture équivalente. Toutes les
règles habituelles s'appliquent (qualité, géants, marché fou : cours × 1 fixe ; carrière : cours × 1, hors saison × 1,25).
Pas de recette d'atelier. Elles ne comptent pas pour « Herbier complet » (liste inchangée) ; elles sont comptées pour
l'album (lot 4). Feuille des graines : badge « Rare · 4 graines » ; « Semer partout » les utilise jusqu'au bout du sachet.

Interface : toucher la roulotte → feuille « **Basile le colporteur** » : portrait, une phrase (« Des trésors de la route,
pour aujourd'hui et demain ! »), 3 ou 4 tuiles (≥ 72 px : icône, nom, effet en une ligne, bouton prix), « Vendu » après
l'achat. Toast à l'arrivée « Basile le colporteur est là (jusqu'à demain soir) » avec « Voir ».

## 16.8 Articulation avec l'existant (fusions et remplacements)

| Existant | Décision | Pourquoi |
|---|---|---|
| **Visiteur acheteur** (événement au hasard de la carrière, une commande à la fois, 5 jours, × 1,5) | **Remplacé** par le tableau du village quand la variété est active (son poids passe à 0 ; ses noms deviennent des clients du tableau). Une commande de visiteur déjà ouverte dans une sauvegarde se termine normalement. | Même idée en mieux : visible en permanence, au choix, sans échéance ; garder les deux ferait deux systèmes de commandes concurrents. |
| **Marchand ambulant** (événement au hasard, rang ≥ 2, un objet pour la journée) | **Remplacé** par le colporteur à date fixe (poids 0) ; ses trois objets (engrais 150, deux poules 40, ruche 40) passent dans l'étal du colporteur avec les mêmes prix et effets. Offre en cours dans une sauvegarde : se termine normalement. | « Le jour du colporteur » crée l'attente sans la frustration d'un passage au hasard d'une journée. |
| **Tirage des événements au hasard** (15 % par jour) | **10 %** quand la variété est active. | Sans visiteur ni marchand (28 points de poids sur 78), les autres événements (touristes, corbeaux, arc-en-ciel, rosée, animal perdu, cadeau de Joseph) gardent la même fréquence qu'avant (≈ 0,7 par semaine). Le flux `events` tire le même nombre de nombres à chaque aube. |
| **Quêtes de Joseph** | **Gardées telles quelles** : une à la fois, longues, avec amitié (♥) et l'objectif du rang 4. Le tableau n'en demande jamais la culture ; la quête passe en premier pour les récoltes. | Joseph = un fil d'amitié rare et long ; le tableau = des petites demandes anonymes et quotidiennes. Différents par le rythme, la récompense et l'histoire : pas de doublon. |
| **Comice** (carrière) et **concours du niveau 12** | Inchangés. Les récoltes livrées comptent toujours. | Objectifs d'année, différents des défis de saison. |
| **Fêtes du calendrier** | Inchangées ; la fête de l'année à thème s'y ajoute, d'autres jours. | |
| **Vœu « une bourse »** (lot 2) et carte « La bourse du village » | Les deux restent (rares tous les deux). | |
| **Bonus permanent « Almanach »** | L'almanach du colporteur et la carte « Almanach du berger » ne sont pas proposés quand il est actif. | Pas d'objet inutile. |

## 16.9 Activation, sauvegardes, cas limites

- **Activation** : `createGame({ variety })` : défaut **activé en Détente, désactivé en Classique** ; `createCareer({
  variety })` : défaut activé. On peut désactiver une partie de la variété pour les tests et la simulation (`variety: {
  board, cards, cart, challenges, merchant, themes }`). Le mode Classique n'a aucun réglage d'interface pour l'activer
  (point ouvert, § 16.11).
- **Sauvegardes** : une partie Détente d'avant le lot 3 reçoit la variété à la reprise (tableau rempli à l'aube suivante,
  charrette et défis à la saison suivante, cartes à la fin de la saison en cours) ; une partie Classique jamais ; une
  carrière la reçoit à la reprise, **sans thème pour l'année en cours** (le premier thème au bilan suivant).
- Tutoriel du niveau 1 : tableau à partir du 5e jour, charrette et colporteur à partir de l'été, défis à partir de l'été,
  première carte à la fin du printemps ; un conseil « première fois » pour chaque nouveauté (`variety.board`,
  `variety.cart`, `variety.cards`, `variety.challenges`, `variety.merchant`, `variety.rare`, `career.theme`).
- Lecture : toute feuille du lot (tableau, charrette, colporteur, cadeau, défis) met le jeu en pause pendant la lecture
  quand l'option « Pause pendant la lecture » est active (lot 1) ; aucune ne s'ouvre toute seule, sauf la fenêtre de fin de
  saison (qui existe déjà).
- Rien n'oblige à ouvrir ces feuilles : un joueur qui les ignore joue exactement comme avant, avec quelques primes en
  plus (commandes et charrette remplies par hasard).

## 16.10 Équilibre (cibles à vérifier par la simulation)

Commandes : `node tools/simulate.js --compare-variety [--strategy casual]` et `node tools/simulate-career.js
--compare-variety` (même graine, sans → avec ; surprises actives des deux côtés). Les robots apprennent la variété par
l'API publique (§ ARCHITECTURE, « Lot 3 ») : le joueur tranquille regarde le tableau un jour sur deux, garde une commande
sur deux quand il peut la semer, pondère son « semer partout » × 2 vers les cultures demandées, choisit une carte au hasard,
garde 2 défis au hasard, achète un sachet de graines rares 40 % du temps s'il a la marge ; le débutant ne garde rien,
prend la première carte, ignore les défis, achète au colporteur 20 % du temps ; l'appliqué choisit au mieux.

| Mesure (Détente, 200 parties par niveau) | Cible |
|---|---|
| Revenu de l'année, joueur tranquille | **+6 à +10 %** (tableau +3 à 4 %, cartes +2 à 3 %, charrette +1,5 à 2 %, défis +1 %, colporteur ≈ +0,5 %) |
| Débutant · appliqué | ≤ +6 % · ≤ +12 % |
| Victoires | inchangées ou meilleures (cibles du § 13.6 tenues) |
| Écus gagnés par année (défis + charrette) | ≈ 8 à 15 (avant : 25 à 45 par victoire) |
| Seuils d'étoiles Détente | **recalculés** avec la variété active selon la règle du § 13.3 : ★★ ≈ argent final médian du joueur tranquille (45 à 55 % l'obtiennent), ★★★ ≈ ses 12 % meilleures parties ; niveau 2 : ★★★ reste rare pour le débutant (≈ 16 %). Attendu : argent final médian du joueur tranquille **+25 à +35 %** (le revenu en plus pèse beaucoup sur ce qui reste en fin d'année, comme au lot 2), donc des seuils relevés d'environ **20 à 30 %** ; les valeurs exactes remplacent celles de `src/data/difficulty.js` et du tableau du § 13.3. |
| Classique | **identique** (pas de variété, test de parité) |
| Carrière (60 carrières × 10 ans) | revenu du joueur tranquille **≤ +8 %** ; rang médian par année identique à un an près ; Domaine (médiane) à un an près ; aucune faillite en Détente ; sollicitations au hasard par semaine inchangées (≈ 1 avec les quêtes) |

Leviers si une cible n'est pas tenue (dans cet ordre) : taux de prime du tableau (poids), part de la prime de la
charrette (10 % / 10 %), valeurs des cartes, tailles des commandes. Jamais les chiffres des niveaux.

### 16.10.1 Réglages après simulation *(équilibré, 2026-10-02)*

`src/data/variety.js` et `src/data/career/themes.js` font foi. Leviers employés, dans l'ordre du tableau ci-dessus :

| Réglage | Conception (§ 16.2 à § 16.7) | Après simulation |
|---|---|---|
| Taux de prime d'une commande (poids) | × 1,2 (4), × 1,3 (3), × 1,4 (2), × 1,5 (1) | **× 1,05 (6), × 1,1 (3), × 1,15 (1)** (deux lignes : + 0,1 ; crieur : + 0,1) |
| Taille d'une commande : plafond | ⌊parcelles / 3⌋ | **⌊parcelles / 2⌋** |
| Prime de la charrette | 10 % + 10 % | **5 % + 5 %** (2 écus si pleine, cheval × 2) |
| Cartes (niveaux) | bourse 20 + 5 × saison ; engrais + 10 % ; poule 4 ; arrosoir 4 ; affiche + 5 % ; recette, foin + 15 % ; sachet 4 graines | **bourse 12 + 4 × saison ; engrais + 8 % ; poule 3 ; arrosoir 3 ; affiche + 4 % ; recette, foin + 10 % ; sachet 3 graines** |
| Cartes (carrière) | bourse 30 + 20 × rang ; arrosoir 6 ; défrichage − 50 % ; sachet 8 | **bourse 20 + 10 × rang ; arrosoir 4 ; défrichage − 25 % ; sachet 6** |
| Défis : cibles (bronze / argent / or) | cueillette 12/20/30 × k ; ventes 150/260/380 × k × prix ; potager 2/3/4 ; semeur 2/3/4 ; soins 3/6/10 × k ; main verte 1/2/4 ; ami du village 1/2/3 ; fait maison 2/4/6 ; verger 1/2/4 ; basse-cour 25/45/70 ; abris 5/9/14 | **20/36/54 × k ; 300/520/760 × k × prix ; 3/4/6 ; 4/5/6 ; 6/12/20 × k ; 1/3/5 ; 2/3/5 ; 3/6/9 ; 2/4/6 ; 45/80/120 ; 6/11/17** |
| Médailles (carrière) | argent 10 × rang, or 20 × rang pièces | **argent 4 × rang, or 8 × rang** (5 / 10 avant la QA du 2026-10-02 : la commande gardée d'office au semis portait la carrière à + 8,1 %) (écus inchangés ; niveaux inchangés) |
| Graines rares (carrière) | 12 semis par sachet | **8 semis** (mêmes prix) |
| Année des grenouilles | averse 30 % des jours nuageux | **15 %** |

### 16.10.2 Résultats *(2026-10-02 ; Détente, surprises actives des deux côtés, 200 parties par niveau ; carrière : 60 carrières × 10 ans, saisons de 7 jours)*

`node tools/simulate.js --compare-variety` (sans → avec, même graine) :

| # | casual : revenu (écart) | victoires | novice : revenu (écart) | victoires | casual, gain par partie : tableau · cartes · charrette · médailles · colporteur (dépense) · écus |
|---|---|---|---|---|---|
| 1 | 1889 → 2048 (+8,4 %) | 100 → 100 % | 1139 → 1218 (+6,9 %) | 99 → 98 % | 60 · 13 · 11 · 20 · 43 · 7 |
| 2 | 1913 → 2127 (+11,2 %) | 99 → 100 % | 1154 → 1206 (+4,5 %) | 100 → 99 % | 61 · 11 · 15 · 19 · 47 · 8 |
| 3 | 1991 → 2170 (+9,0 %) | 100 → 100 % | 1148 → 1235 (+7,6 %) | 98 → 99 % | 59 · 11 · 14 · 26 · 49 · 9 |
| 4 | 1598 → 1738 (+8,8 %) | 100 → 100 % | 1055 → 1119 (+6,1 %) | 100 → 100 % | 35 · 10 · 4 · 21 · 52 · 7 |
| 5 | 2657 → 3037 (+14,3 %) | 98 → 99 % | 1472 → 1590 (+8,0 %) | 95 → 96 % | 81 · 11 · 20 · 29 · 47 · 10 |
| 6 | 2070 → 2274 (+9,9 %) | 97 → 98 % | 1152 → 1242 (+7,8 %) | 90 → 95 % | 61 · 10 · 15 · 24 · 50 · 9 |
| 7 | 2438 → 2599 (+6,6 %) | 95 → 97 % | 1296 → 1373 (+5,9 %) | 94 → 96 % | 62 · 10 · 16 · 25 · 51 · 9 |
| 8 | 2153 → 2327 (+8,1 %) | 100 → 100 % | 1116 → 1217 (+9,1 %) | 93 → 95 % | 57 · 11 · 14 · 23 · 54 · 8 |
| 9 | 1603 → 1704 (+6,3 %) | 98 → 100 % | 863 → 939 (+8,8 %) | 100 → 100 % | 36 · 10 · 9 · 13 · 56 · 6 |
| 10 | 2168 → 2284 (+5,4 %) | 100 → 100 % | 1330 → 1371 (+3,1 %) | 100 → 100 % | 35 · 10 · 8 · 12 · 70 · 6 |
| 11 | 1910 → 2044 (+7,0 %) | 100 → 100 % | 1228 → 1274 (+3,7 %) | 100 → 100 % | 47 · 9 · 7 · 24 · 54 · 9 |
| 12 | 2348 → 2449 (+4,3 %) | 100 → 100 % | 1469 → 1550 (+5,5 %) | 100 → 100 % | 49 · 10 · 11 · 14 · 55 · 6 |

- **Revenu de l'année, moyenne des 12 niveaux** *(après la QA du 2026-10-02 : paliers des défis, commande gardée d'office)* :
  casual **+8,3 %** (cible + 6 à + 10 % ; + 8,5 % avant), novice **+6,4 %** (cible ≤ + 6 % ; + 6,2 % avant : il ne garde
  jamais à la main, la garde d'office au semis l'aide un peu), optimal **+7,8 %** (≤ + 12 %) ; careless + 9,7 %, balanced
  + 8,8 %, investor + 8,1 %, idle 0 % (toujours 100 % de faillites). Le niveau 5 (hiver de 14 jours) donne le plus (+ 14,3 %) : le tableau y travaille tout
  l'hiver.
- **Victoires** : inchangées ou meilleures à ± 1 point (bruit) ; toutes les cibles du § 13.6 restent tenues.
- **Argent final médian du joueur tranquille** : **+ 56 %** en moyenne (plus que les + 25 à + 35 % attendus : le revenu en
  plus arrive presque tout au solde de fin d'année) — d'où les seuils d'étoiles Détente relevés (§ 13.3).
- **Écus par année** (défis + charrette) : 6,5 à 11 pour le joueur tranquille (cible 8 à 15).
- Une partie isolée ajoute peu (tableau seul ≈ + 1,5 à + 5 %, cadeaux ≈ + 2 à + 3,5 %, charrette ≈ + 1 à + 3 %, défis ≈
  + 1 %, colporteur ≈ + 1 à + 2 %) : les parties se renforcent un peu (cultures demandées, primes réinvesties).

`node tools/simulate-career.js --compare-variety --runs 60` :

| Joueur | Revenu (moyenne des 10 ans) | Rang médian par année | Domaine (médiane) | Faillites | Sollicitations / semaine (événements au hasard) |
|---|---|---|---|---|---|
| casual | **+ 7,8 %** (cible ≤ + 8 %) | identique (2 2 3 4 4 5 5 6 6 6) | an 8 → an 8 | 0 % | 1,03 → 0,67 (0,88 → 0,57) |
| novice | + 14,5 % | identique, an 10 : 5 → 6 | jamais → an 10 | 0 % | 1,01 → 0,61 |
| optimal | + 2,9 % | identique | an 6 → an 6 | 0 % | 0,81 → 0,42 |
| automator | + 2,9 % | identique | an 6 → an 6 | 0 % | 0,96 → 0,64 |
| idle | + 8,4 % | identique (2) | jamais | 0 % | 1,11 → 0,58 |

*(Après la QA du 2026-10-02. Avec la commande gardée d'office et les nouveaux paliers, la carrière du joueur tranquille
montait à + 8,1 % : médailles de carrière ramenées de 5 / 10 à **4 / 8 × rang** pièces → + 7,8 %. Avant la QA : casual
+ 7,6 %, novice + 13,6 %, optimal + 3,1 %, automator + 3,0 %, idle + 6,6 %.)*

- Les événements au hasard **autres** que le visiteur et le marchand gardent leur fréquence (≈ 0,56 par semaine avant
  comme après) ; les « sollicitations » baissent parce que le visiteur acheteur et le marchand ambulant sont remplacés par
  le tableau (toujours là, sans échéance) et le colporteur (à date fixe).
- Le débutant gagne le plus en pourcentage (thèmes : vedette, averses ; cadeaux) sans changer son rythme de rangs ; aucune
  cible de carrière ne porte sur lui.
- Gains moyens par carrière (casual, 10 ans) : tableau 853, cadeaux 282, charrette 378, médailles 1 160 pièces et 168 écus,
  colporteur − 1 641 (graines rares, objets).

## 16.11 Points ouverts

- Un interrupteur « Variété » dans le choix du niveau pour la proposer aussi en Classique (désactivée par défaut) ?
- Commandes de produits animaux (œufs, fromages) en carrière : laissées aux quêtes de Joseph et au comice pour l'instant.
- Succès liés au lot (« 50 commandes livrées », « une charrette pleine », « 10 médailles d'or ») : à décider avec l'album
  (lot 4), qui lira les compteurs `state.variety.stats` et `progress.lifetime.variety`.

---

# 17. Lot 4 — Collection & enjeux doux (conception, 2026-10-03)

Synthèse : `docs/analyse/0-SYNTHESE.md`, points **D1** (album), **D3** (lanternes), **F1** (aider sans remplacer), **C6**
(fêtes participatives) et **C8** (hiver vivant) ; décision de l'utilisateur (2026-10-02) : « en carrière, salariés et
machines aident sans remplacer ». Contrat de code : `docs/ARCHITECTURE.md`, « Lot 4 — contrats ». Nombres de référence
(réglés ensuite par la simulation) : `src/data/album.js`, `src/data/cozy.js`, `src/data/career/*` (F1).

**But** : donner au joueur des objectifs **moyens et longs** qui ne sont pas l'argent (remplir l'album, allumer des
lanternes, réussir son stand), un **enjeu doux** à la Détente (niveaux et carrière) sans jamais punir, **remettre le
joueur au centre** de sa ferme de carrière (la récolte à la main redevient le moment fort, la ferme ne s'enrichit plus
toute seule), et faire de l'**hiver** une saison qu'on attend au lieu d'un temps mort.

Le lot 5 (« La Vallée vivante », `docs/analyse/5-idees-projet-long.md`) n'est **pas** réalisé ici ; le § 17.9 dit ce que
le lot 4 prépare pour lui (crochets d'album, oiseaux, traces, graines anciennes, histoires de Joseph).

## 17.0 Règles d'or du lot

1. **Aucun stress** : aucun chrono punitif (la chasse aux œufs met le jeu en pause, une fête dure toute la journée et ce
   qu'on n'a pas fait est fait gentiment par les enfants du village), aucun échec (toute participation reçoit au moins
   un ruban, une louche, un merci), **aucune peur de rater** (les fêtes reviennent chaque année, l'album n'a aucune case
   « une seule fois », les trouvailles d'hiver attendent), **aucune nouvelle monnaie** (pièces de la partie et écus
   décoratifs seulement ; rubans et lanternes ne s'échangent contre rien).
2. **Jamais de punition** : une lanterne au moins par critère, les lanternes ne changent ni les étoiles ni l'argent ;
   « aider sans remplacer » n'enlève rien à un joueur qui récolte (sa récolte vaut plus), et rien ne reste jamais bloqué
   (l'équipe finit toujours par récolter ce qui attend).
3. **Téléphone portrait d'abord** : feuilles du bas, cases et boutons ≥ 48 px (cases d'album 104 × 120 px), textes
   ≥ 14 px, une phrase par anecdote (≤ 110 caractères), rien seulement au survol.
4. **Mode Classique des niveaux strictement inchangé** (parité `tests/parity.test.js`, `tools/capture-parity.js`) :
   fêtes, hiver vivant et lanternes y sont **absents** (clé d'état absente). **L'album se remplit aussi en Classique**,
   mais seulement à partir de ce que la partie expose déjà (requêtes en lecture, bilan de fin) et **hors de l'état de
   jeu** (progression permanente, comme les cumuls et les succès) : voir § 17.6.
5. **Logique pure et déterministe** : un seul flux aléatoire nouveau, `cozy` (œufs, trouvailles d'hiver, oiseaux,
   villageois des paniers) ; aucun flux existant ne tire un nombre de plus. Les règles F1 de la carrière ne tirent rien.
6. **Équilibre** : le lot ajoute **+2 à +5 %** au revenu de l'année du joueur tranquille (niveaux), **−1 à +5 %** en
   carrière (F1 retire un peu, fêtes et hiver rendent un peu) ; la ferme de carrière **laissée seule** gagne au moins
   **deux fois moins** qu'avant ; aucune faillite nouvelle ; seuils d'étoiles Détente recalculés (§ 13.3).

## 17.1 D1 — L'album de la ferme

Un grand **album relié** (« L'album de la ferme ») : une page par famille, une **case** par chose vécue à la ferme,
avec une **petite anecdote** cosy qui se lit quand la case est trouvée. **Commun aux deux modes** : c'est une
progression **permanente** (dans la progression, à côté des succès et des écus), qui se remplit en jouant normalement.

### 17.1.1 Règles

- **Case trouvée** : la première fois que la condition de la case est remplie, dans n'importe quel mode (niveaux
  Détente ou Classique, carrière). Une case trouvée l'est pour toujours (« Effacer la progression » vide l'album).
- **Tampons** (cultures seulement) : chaque case du potager porte jusqu'à deux tampons en plus — **★ dorée** (une récolte
  dorée à la main de cette culture) et **◆ géante** (un légume géant de cette culture récolté). Le pommier n'a pas de
  tampon géant. Les tampons ne sont pas nécessaires pour compléter la page ; ils complètent la **page dorée** et la
  **page des géants** (récompenses en plus).
- **Case pas encore trouvée** : silhouette grise, nom affiché (pas de mystère frustrant), et un **indice** d'une ligne
  au toucher (« Récoltez-en une », « Un matin de brouillard, en automne », « Dans Ma ferme, avec une mare »). Les cases
  qu'un mode ne peut pas donner le disent (« À découvrir dans Ma ferme », « En Détente ou dans Ma ferme »).
- **Page complète** : un bandeau « Page complète ! » et un bouton **« Recevoir »** (aucune échéance) : écus + un décor
  unique « Trouvé dans l'album » (catégorie `found`, non achetable, posé comme les autres décors, **sans aucun effet**).
- **Nouveauté** : une case trouvée en partie donne un message discret (« Album : Pluie chaude ✓ », un seul message par
  aube, les autres vont dans l'historique) et une pastille sur l'entrée de l'album ; la case garde un badge « Nouveau »
  jusqu'à ce qu'on l'ait vue.
- **Où** : grange aux souvenirs (4ᵉ onglet « Album », le menu principal y mène) ; en partie : Menu → « L'album » (le
  jeu se met en pause). Feuille haute : titre de la page, « 9 / 15 », flèches ‹ › (48 × 48) et points de page, grille de
  3 colonnes ; toucher une case trouvée → fiche du bas : grand dessin (×3), nom, anecdote, « Trouvée le 3 oct. · Ma ferme ».
- **Vérification** : à chaque aube et à chaque fin de partie / bilan annuel (comme les succès), à partir du contexte de
  la partie en cours et de la progression ; au premier démarrage du lot 4 : **rattrapage** (§ 17.1.4).

**Indices** (une ligne au toucher d'une case pas encore trouvée ; `{nom}` = nom de la case ; suffixe selon le mode :
« · dans Ma ferme » pour (C), « · en Détente ou dans Ma ferme » pour (D/C) quand on joue en Classique) :

| Page | Indice |
|---|---|
| Le potager | « Récoltez une {nom}. » (rares : « Basile vend parfois ses graines. ») ; tampons : « Une récolte dorée, à la main » · « Un carré de 4, semé le même jour, bien arrosé… » |
| Fait maison et basse-cour | « Vendez ce produit de l'atelier. » / « Ramassez-en à l'abri. » / « Gardez des moutons jusqu'à la tonte. » |
| Les animaux | « Accueillez cet animal à la ferme. » (chat, chien : « Un jour, un petit animal perdu… ») |
| Le ciel | « Un jour de {nom}… » (spéciales : la saison et le temps de base, ex. « Une pluie, au printemps ou en été ») |
| Petits bonheurs | « Une surprise de l'aube… » / « En défrichant un terrain… » |
| Le village | « Livrez une commande à {nom}. » / « Le colporteur passe le 5ᵉ jour de chaque saison. » |
| Les années à thème | « Une année à thème… » (visible dès le rang du thème) |
| Les fêtes | « Jouez à la fête : {saison}, jour {n}. » |
| La lisière en hiver | « En hiver, en lisière de la forêt. » / traces : « Un jour de neige. » |
| La mangeoire et la mare | « Remplissez la mangeoire en hiver. » (rares : « … plusieurs jours de suite. ») / « Pêchez à la mare. » |
| Les veillées de Joseph | « Un soir d'hiver, chez Joseph. » |

### 17.1.2 Les pages et les cases (124 cases, 11 pages)

Colonnes : identifiant de case, nom, **condition** (où le cœur la lit : § ARCHITECTURE), anecdote. « Partout » = niveaux
(Détente et Classique) et carrière ; « D/C » = Détente ou carrière (contenu des lots 2 à 4) ; « C » = carrière seulement.

#### Page 1 — `garden` « Le potager » (15 cases ; tampons ★ et ◆)

Condition commune : récolter la culture une fois (partout). ★ : une récolte dorée à la main (D/C). ◆ : un géant récolté (D/C).

| Case | Nom | Anecdote |
|---|---|---|
| `carrot` | Carotte | Les fanes se mangent aussi : en pesto, Mamie Odette jure que c'est un délice. |
| `turnip` | Navet | Avant la pomme de terre, c'était lui qui remplissait les marmites d'hiver. |
| `wheat` | Blé | Un seul grain semé donne un épi d'une quarantaine de grains : de quoi faire rêver le boulanger. |
| `cabbage` | Chou | Il aime le froid : après une gelée, ses feuilles deviennent plus sucrées. |
| `tomato` | Tomate | On l'a longtemps crue toxique : on la cultivait pour décorer les jardins. |
| `corn` | Maïs | Chaque fil soyeux de l'épi correspond à un grain : pas de fil, pas de grain ! |
| `sunflower` | Tournesol | Jeune, il suit le soleil d'est en ouest ; adulte, il regarde l'est pour toujours. |
| `potato` | Pomme de terre | Parmentier faisait garder ses champs le jour… pour donner envie de les voler la nuit. |
| `strawberry` | Fraise | Ses vraies graines sont les petits points dorés sur sa peau. |
| `zucchini` | Courgette | Oubliez-en une trois jours sous les feuilles : elle devient une massue. |
| `pumpkin` | Citrouille | Les plus grosses du monde pèsent plus lourd qu'une vache. |
| `apple` | Pomme (★ seulement) | Un pommier peut donner des pommes pendant plus de cinquante ans. |
| `pea` | Petits pois (D/C) | Mendel a découvert l'hérédité en comptant des petits pois, lisses ou ridés. |
| `melon` | Melon (D/C) | Un bon melon est lourd dans la main et sent bon près de la queue. |
| `leek` | Poireau (D/C) | Au pays de Galles, on en épingle un au chapeau le 1er mars. |

#### Page 2 — `homemade` « Fait maison et basse-cour » (12 cases)

| Case | Nom | Condition | Anecdote |
|---|---|---|---|
| `strawberryJam` | Confiture de fraises | vendre le produit (partout) | Autant de sucre que de fruits : la règle des confitures de grand-mère. |
| `appleJuice` | Jus de pomme | idem | Il faut environ deux kilos de pommes pour un litre de jus. |
| `cowCheese` | Fromage de vache | idem | Une dizaine de litres de lait pour un kilo de fromage. |
| `goatCheese` | Fromage de chèvre | idem | Frais, il se tartine ; sec, il se râpe : la chèvre est polyvalente. |
| `flour` | Farine | idem | Au moulin, la meule du dessous ne tourne pas : c'est celle du dessus qui travaille. |
| `bread` | Pain | idem | Les miettes allaient aux poules : rien ne se perdait. |
| `eggs` | Œufs | niveaux : un poulailler a rapporté à l'aube ; carrière : des œufs ramassés | Une poule pond presque un œuf par jour quand les jours sont longs. |
| `milk` | Lait | niveaux : une vache ou une chèvre a rapporté ; carrière : du lait ramassé ou parti à la fromagerie | Une vache boit jusqu'à cent litres d'eau par jour. |
| `wool` | Laine | une tonte de moutons (partout) | Une tonte donne environ quatre kilos de laine par mouton. |
| `angora` | Laine angora (C) | laine angora ramassée | On dit la laine angora sept fois plus chaude que celle du mouton. |
| `duckEgg` | Œufs de cane (C) | œufs de cane ramassés | Plus gros que ceux de poule, ils font des gâteaux plus moelleux. |
| `truffle` | Truffe (C) | une truffe trouvée | Autrefois, on cherchait les truffes avec des cochons… qui les aimaient un peu trop. |

#### Page 3 — `animals` « Les animaux » (11 cases)

Condition : posséder l'animal à une aube (niveaux : poulailler → poule, vache, mouton, chèvre, ruche → abeilles ;
carrière : l'espèce) ; chat et chien : adoptés (carrière, événement « animal perdu »).

| Case | Nom | Anecdote |
|---|---|---|
| `hen` | Poule | Les poules reconnaissent une centaine de visages, humains compris. |
| `cow` | Vache | Les vaches ont une meilleure amie, et s'ennuient loin d'elle. |
| `sheep` | Mouton | Un mouton se souvient de cinquante visages pendant deux ans. |
| `goat` | Chèvre | Ses pupilles rectangulaires lui font voir presque tout autour d'elle. |
| `bees` | Abeilles | Pour un pot de miel, les abeilles visitent des millions de fleurs. |
| `rabbit` | Lapin (C) | Un lapin heureux saute en l'air en se tortillant : on appelle ça un « binky ». |
| `duck` | Canard (C) | Les canetons suivent la première chose qu'ils voient bouger en sortant de l'œuf. |
| `pig` | Cochon (C) | Le cochon est propre : il se roule dans la boue pour se rafraîchir. |
| `horse` | Cheval (C) | Un cheval peut dormir debout : ses jambes se verrouillent toutes seules. |
| `cat` | Chat (C) | Le chat de ferme garde le grenier des souris depuis des milliers d'années. |
| `dog` | Chien (C) | Un chien de berger comprend des dizaines de mots et de coups de sifflet. |

#### Page 4 — `sky` « Le ciel » (8 cases)

Condition : avoir eu ce temps (orage, canicule, neige : la météo du jour, partout ; les cinq autres : météos spéciales
du lot 2, D/C ; arc-en-ciel de carrière compris).

| Case | Nom | Anecdote |
|---|---|---|
| `storm` | Orage | Comptez les secondes entre l'éclair et le tonnerre : trois secondes, un kilomètre. |
| `heatwave` | Canicule | Par grosse chaleur, on arrose le soir : l'eau s'évapore moins vite. |
| `snow` | Neige | La neige est une couverture : dessous, le sol gèle moins. |
| `warmrain` | Pluie chaude | Après une pluie tiède, on dit que l'herbe pousse « à vue d'œil ». |
| `fog` | Brouillard | Un matin de brouillard en automne, les champignons sortent de partout. |
| `shootingstar` | Étoiles filantes | Ce sont des grains de poussière qui brûlent très haut dans le ciel. |
| `goldenhour` | Heure dorée | Juste avant le coucher du soleil, tout prend une couleur de miel. |
| `rainbow` | Arc-en-ciel | On ne voit un arc-en-ciel que dos au soleil. |

#### Page 5 — `luck` « Petits bonheurs » (13 cases, D/C)

Condition : avoir vécu la surprise de l'aube (lot 2), la cueillette, le vœu, ou la trouvaille au défrichage (carrière).

| Case | Nom | Anecdote |
|---|---|---|
| `fairy` | La fée des cultures | Personne ne l'a jamais vue en plein jour. Mais les choux, eux, s'en souviennent. |
| `chest` | Un vieux coffre | Les anciens cachaient leurs économies dans un coffre… et oubliaient parfois où. |
| `ring` | Un cercle de fées | Les champignons poussent en rond, et le cercle s'élargit un peu chaque année. |
| `mushrooms` | Champignons du brouillard | Cueillez-les au couteau, sans arracher : ils repousseront. |
| `fox` | Un renard (C) | Un renard près d'un champ, c'est moins de corbeaux… et de campagnols. |
| `hedgehog` | Un hérisson | Un hérisson mange des dizaines de limaces et d'insectes chaque nuit. |
| `owl` | La chouette sculptée | Le sculpteur l'avait posée là pour faire peur aux souris. |
| `wish` | Un vœu exaucé | Il paraît qu'un vœu dit tout bas porte plus loin. |
| `coins` | Un pot de pièces (C) | Une pièce de 1900 ! Le grand-père de Joseph en a peut-être perdu d'autres… |
| `seedjar` | Un bocal de graines anciennes (C) | Certaines graines dorment des dizaines d'années avant de germer. |
| `well` | Un vieux puits (C) | Avant le robinet, chaque ferme avait son puits, et son seau qui grince. |
| `lamb` | Un agneau perdu (C) | Un agneau reconnaît la voix de sa mère parmi tout le troupeau. |
| `statue` | Une petite statue (C) | C'est saint Fiacre, le patron des jardiniers. |

#### Page 6 — `village` « Le village » (13 cases, D/C)

Condition : une **commande livrée** à ce client du tableau (lot 3) ; Basile : **son premier passage** à la ferme.

| Case | Nom | Anecdote |
|---|---|---|
| `rose` | Mme Rose, la fleuriste | Elle reconnaît chaque fleur du village à son parfum, les yeux fermés. |
| `paulo` | Paulo, le boulanger | Il se lève à trois heures du matin, et chante en pétrissant. |
| `lili` | La petite Lili | Son lapin Caramel a droit à une carotte par jour, pas une de plus. |
| `garnier` | M. Garnier, l'instituteur | Chaque printemps, sa classe sème des radis dans des pots de yaourt. |
| `chevalier` | Mme Chevalier, l'aubergiste | Sa soupe du soir n'a jamais deux fois la même recette. |
| `fabre` | Le père Fabre, pêcheur | Il a pris un brochet long comme un bras. Le bras grandit à chaque fois qu'il le raconte. |
| `perrin` | Mlle Perrin, la musicienne | Elle accorde son violon sur le chant du merle. |
| `maire` | M. le maire | Son écharpe tricolore ne sort que pour les fêtes et les mariages. |
| `odette` | Mamie Odette | Ses bocaux sont rangés par année, depuis 1974. |
| `leon` | Léon, le facteur | Il connaît le nom de tous les chiens du village, et leurs humeurs. |
| `morel` | Mme Morel, la couturière | Elle teint ses laines au tournesol et à la pelure d'oignon. |
| `twins` | Zoé et Bastien, les jumeaux | Leur cabane secrète est au fond du verger. Tout le monde le sait. Chut. |
| `basile` | Basile le colporteur | Sa roulotte a fait trois fois le tour du pays. Il ne dit jamais par où. |

#### Page 7 — `years` « Les années à thème » (9 cases, C ; tampons 🎪 fête et ✉ visiteur)

Condition : avoir vécu l'année à thème (lot 3). Tampon 🎪 : avoir joué à sa fête (§ 17.4.6) ; tampon ✉ : avoir accepté
le cadeau de son visiteur. Les tampons complètent la « page des grandes années » (récompense en plus).

| Case | Nom (visiteur) | Anecdote |
|---|---|---|
| `bees` | L'année des abeilles (Margot) | Margot parle à ses ruches chaque matin : les abeilles aiment les nouvelles. |
| `cheese` | L'année du fromage (Anselme) | Anselme retourne ses meules à la main, une par une, chaque matin. |
| `tourism` | Le boom touristique (la journaliste) | Son article a fait venir des visiteurs jusque de la ville. |
| `giants` | L'année des géants (Gaspard) | Gaspard parle à ses citrouilles. Il prétend qu'elles écoutent. |
| `frogs` | L'année des grenouilles (Firmin) | Quand les grenouilles chantent fort le soir, Firmin annonce la pluie. |
| `orchard` | L'année des vergers (Mathis) | Mathis greffe ses pommiers comme on coud : avec patience et du raphia. |
| `bread` | L'année du pain (Jeanne) | Jeanne connaît le vent mieux que personne : c'est lui qui fait tourner son moulin. |
| `markets` | Les grands marchés (le grossiste) | Il pèse tout d'un coup d'œil, et se trompe rarement de plus d'une pomme. |
| `lights` | L'année des lumières (le colporteur du Nord) | Chez lui, l'hiver dure six mois, et l'on chante pour faire revenir le soleil. |

#### Page 8 — `fetes` « Les fêtes » (9 cases, D/C ; tampon 🏅 « le meilleur résultat »)

Condition : avoir **participé** (joué le mini-jeu, § 17.4) ; 🏅 : 8 œufs trouvés soi-même, 3 louches, rosette d'or,
6 ♥ aux paniers, 20 sachets à la foire. Comice, concours, charrette et médaille : réussis (lots précédents).

| Case | Nom | Condition | Anecdote |
|---|---|---|---|
| `seedFair` | La foire aux graines (C) | acheter un sachet à la foire | À la fin de l'hiver, on échangeait ses plus belles graines, avant les semis. |
| `eggHunt` | La chasse aux œufs | trouver un œuf | Teints à la pelure d'oignon, les œufs sortaient couleur cuivre. |
| `soup` | La soupe partagée | goûter la soupe | Chacun apporte un légume : c'est toute l'histoire de la soupe au caillou. |
| `stand` | Le stand de la ferme | présenter son stand | Le maire juge les stands avec un carnet… et goûte un peu de tout. |
| `christmas` | Les paniers de Noël | offrir les paniers | Un panier offert à un voisin revient toujours, rempli d'autre chose. |
| `comice` | Le comice agricole (C) | une épreuve du comice réussie | Les premiers comices, au XIXᵉ siècle, primaient les plus belles bêtes du canton. |
| `contest` | Le concours du village | une épreuve du concours du niveau 12 réussie | La plus grosse citrouille du concours a dû être portée à quatre. |
| `cart` | La charrette pleine | toutes les caisses d'une charrette (lot 3) | L'âne de la charrette s'appelle Pompon. Il préfère les carottes aux compliments. |
| `goldMedal` | Une médaille d'or | une médaille d'or de défi (lot 3) | Une médaille, ça s'accroche au mur de la cuisine, près du calendrier. |

#### Page 9 — `edge` « La lisière en hiver » (9 cases, D/C)

Condition : ramasser la trouvaille d'hiver (§ 17.5.1) ; traces : les voir dans la neige (un jour de neige).

| Case | Nom | Anecdote |
|---|---|---|
| `deadwood` | Bois mort | Le petit bois sec allume le feu ; les bûches le font durer. |
| `pinecone` | Pommes de pin | Fermées quand il fait humide, ouvertes quand il fait sec : un vrai baromètre. |
| `holly` | Houx | Seuls les houx femelles portent des boules rouges. |
| `blewit` | Pieds-bleus | Ce champignon d'hiver a le pied violet et une odeur fruitée. |
| `chestnut` | Châtaignes | Une bogue piquante cache deux ou trois châtaignes. |
| `mistletoe` | Gui | Le gui pousse sur les arbres sans jamais toucher la terre. |
| `hareTrack` | Traces de lièvre | Les grandes pattes arrière se posent devant les petites : le lièvre est passé en sautant. |
| `deerTrack` | Traces de chevreuil | Deux petits sabots en forme de cœur, bien alignés. |
| `foxTrack` | Traces de renard | Le renard pose ses pattes en ligne droite, comme sur un fil. |

#### Page 10 — `feeder` « La mangeoire et la mare » (13 cases ; oiseaux D/C, poissons C)

Condition : un oiseau venu à la mangeoire (§ 17.5.2) ; un poisson pêché à la mare (carrière, pêche existante).

| Case | Nom | Anecdote |
|---|---|---|
| `greatTit` | Mésange charbonnière | Sa cravate noire : plus elle est large, plus le mâle est fier. |
| `blueTit` | Mésange bleue | Elle s'accroche la tête en bas pour attraper les graines. |
| `robin` | Rouge-gorge | Il suit le jardinier qui bêche, pour attraper les vers. |
| `sparrow` | Moineau | Il prend des bains de poussière pour se débarrasser des petites bêtes. |
| `chaffinch` | Pinson | Les pinsons d'une même région chantent avec le même accent. |
| `bullfinch` | Bouvreuil | Le mâle a la poitrine rose vif ; on le voit surtout quand il fait très froid. |
| `nuthatch` | Sittelle | Le seul oiseau qui descend les troncs la tête en bas. |
| `woodpecker` | Pic épeiche | Il tambourine jusqu'à vingt coups par seconde, sans mal de tête. |
| `gudgeon` | Goujon (C) | Petit poisson des fonds de sable : les pêcheurs le prennent par dizaines. |
| `roach` | Gardon (C) | On le reconnaît à ses yeux rouges. |
| `perch` | Perche (C) | Ses rayures l'aident à se cacher dans les herbes de la mare. |
| `trout` | Truite (C) | Elle ne vit que dans une eau fraîche et propre : c'est bon signe. |
| `pike` | Brochet (C) | Immobile comme un bâton, puis rapide comme une flèche. |

#### Page 11 — `stories` « Les veillées de Joseph » (12 cases, D/C)

Une case par histoire entendue (§ 17.5.3), dans l'ordre (une par hiver joué, niveaux Détente et carrière confondus).
L'anecdote de la case est la première ligne ; la veillée montre les trois lignes.

| Case | Titre | Texte (3 lignes) |
|---|---|---|
| `s1` | La boîte en fer | « Ma mère gardait ses graines dans une boîte à biscuits. » · « Des haricots, des courges, un melon de son village. » · « Je l'ai toujours, tu sais. Un jour, je te la montrerai. » |
| `s2` | Les haies d'autrefois | « Quand j'étais petit, chaque champ avait sa haie. » · « Et chaque haie avait ses merles, ses hérissons, ses mûres. » · « On les a arrachées pour les tracteurs. Les oiseaux sont partis avec. » |
| `s3` | Le ruisseau | « Il y avait un ruisseau, là, derrière les chênes. » · « On y pêchait des écrevisses avec un bout de lard et une ficelle. » · « Il s'est tari l'année de la grande sécheresse. Je l'entends encore, parfois. » |
| `s4` | La grande neige | « L'hiver de mes dix ans, la neige est montée jusqu'aux fenêtres. » · « On sortait par la lucarne du grenier, avec des pelles. » · « Les vaches ont eu chaud tout l'hiver : on dormait presque avec elles ! » |
| `s5` | Pataud | « Mon chien Pataud ramenait les vaches tout seul, le soir. » · « Il connaissait l'heure mieux que l'horloge de l'église. » · « Il me manque encore. Les bons chiens ne s'oublient pas. » |
| `s6` | Le premier tracteur | « Le jour où le premier tracteur est arrivé, tout le village est sorti. » · « Il était rouge, il toussait, et il faisait peur aux poules. » · « Mon père a dit : il ira plus vite, mais il ne saura jamais où pousse la menthe. » |
| `s7` | Le bal | « C'est au bal de juillet, sous les lampions, que j'ai dansé avec Lucienne. » · « Elle m'a marché sur les pieds toute la soirée. » · « On s'est mariés l'année suivante. Elle marchait toujours sur mes pieds. » |
| `s8` | Le colporteur d'antan | « Avant Basile, il y avait son grand-père, avec un âne et deux paniers. » · « Il vendait des aiguilles, du fil, des graines… et des histoires. » · « Les histoires, il les donnait pour rien. C'était le meilleur de sa marchandise. » |
| `s9` | Les cigognes | « Ma grand-mère disait que les cigognes nichaient sur le clocher. » · « Elles revenaient chaque printemps, le même jour, à ce qu'elle disait. » · « Je ne les ai jamais vues. Mais je regarde toujours le clocher, en mars. » |
| `s10` | Le vieux tilleul | « Le grand tilleul de la place, c'est mon père qui l'a planté. » · « L'année de ma naissance, avec un seau d'eau et beaucoup d'espoir. » · « Les tilleuls, ça vit longtemps. Bien plus longtemps que les fermiers. » |
| `s11` | Les hérissons | « On leur laissait une soucoupe de lait, le soir, au bout du jardin. » · « Il paraît que c'est une mauvaise idée, maintenant : de l'eau, et c'est tout. » · « Mais ils revenaient chaque soir. Je crois qu'ils venaient surtout pour la compagnie. » |
| `s12` | La vallée qui chante | « Tu sais, la vallée chantait, avant. Les oiseaux, les grenouilles, le ruisseau. » · « Elle s'est tue petit à petit, sans qu'on y prenne garde. » · « Un jour, elle chantera de nouveau. Il suffit de lui laisser un peu de place. » |

### 17.1.3 Récompenses (cosmétiques seulement)

| Page | Écus | Décor « trouvé dans l'album » (id) |
|---|---|---|
| Le potager | 30 | Épouvantail fleuri (`scarecrow.flower`) |
| Page dorée du potager (★ sur les 15 cases) | 20 | Arrosoir doré (`can.golden`) |
| Page des géants (◆ sur les 14 cases qui en ont) | 20 | Brouette au géant (`barrow.giant`) |
| Fait maison et basse-cour | 25 | Étagère à confitures (`jam.shelf`) |
| Les animaux | 25 | Girouette au cochon (`weathervane.pig`) |
| Le ciel | 20 | Cadran solaire (`sundial`) |
| Petits bonheurs | 30 | Lanterne des fées (`lantern.fairy`) |
| Le village | 25 | Pompe à eau du village (`pump.village`) |
| Les années à thème (+ page des grandes années : 15 écus) | 30 | Mât à guirlandes (`bunting.post`) |
| Les fêtes | 25 | Arche de fête (`arch.fete`) |
| La lisière en hiver | 20 | Tas de bois (`woodpile`) |
| La mangeoire et la mare | 25 | Héron en bois (`heron.wood`) |
| Les veillées de Joseph | 30 | Fauteuil de Joseph (`rocking.chair`) |
| **Album complet** (les 11 pages) | 100 | Le grand herbier (`herbarium`, grand décor 2 × 2) |

Total : 515 écus et 15 décors. Succès nouveaux liés à l'album (écus seulement) : « Première page », « Herbier doré »,
« Album complet » (liste complète du lot : § 17.7.2).

### 17.1.4 Rattrapage depuis les anciennes parties

Au premier démarrage avec le lot 4 (progression sans `album`), les cases que la progression ou les sauvegardes
**prouvent** déjà sont trouvées d'un coup (date « avant l'album »), avec un message « 23 cases de l'album retrouvées
dans vos anciennes parties » (les récompenses de page se reçoivent ensuite normalement) :

| Source | Cases retrouvées |
|---|---|
| `progress.lifetime.cropsHarvested` | potager (cultures ordinaires) |
| `progress.lifetime.productsSold` | produits des ateliers |
| `progress.lifetime.variety.rare` | petits pois, melon, poireau |
| `progress.lifetime.variety.cartsFull` > 0 · `medals.gold` > 0 | charrette pleine · médaille d'or |
| succès débloqués | `henHouse` → poule, œufs ; `herd` → vache, mouton, chèvre, lait ; `truffles` → cochon, truffe ; `menagerie` → les 8 espèces ; `fairChampion` → comice ; `baker` → pain ; `winterTomato` → tomate |
| `progress.levels[12].completed` et le concours gagné | (rien de sûr : on ne retrouve pas le concours) |
| cosmétiques possédés | `owl.carved` → chouette ; `statue.small` → statue ; `lantern.peddler`, `weathervane.rooster` → Basile ; `sign.magazine` → année du tourisme |
| **partie de niveau en cours** (sauvegarde) | ses compteurs de l'année : cultures, produits, investissements (animaux), `surprises.stats` (dorées, géants, surprises, météos, cueillette, vœux), `variety.stats` (clients livrés, médailles, charrettes) |
| **carrière en cours** (sauvegarde) | idem + espèces possédées, animaux de compagnie, `career.lifetime` (truffes), `career.theme.history` (années à thème vécues), trouvailles du défrichage, poissons de l'année |

Ce qui n'a laissé aucune trace (une dorée d'une partie terminée avant le lot 4) n'est pas retrouvé : on la retrouvera
en jouant. Aucune récompense n'est perdue.

## 17.2 D3 — Les lanternes de fin d'année

À la fin de chaque année (niveaux : le soir du fermage d'hiver, juste avant la victoire ; carrière : au bilan de
l'année), Joseph allume des **lanternes** sur le perron de la ferme : **1 à 4 lanternes** pour chacun des **5 critères**
visibles. On ne perd jamais une lanterne : chaque critère en a au moins une, et l'année suivante (ou la partie suivante
du même niveau) on peut toujours faire mieux. Les lanternes **ne changent ni les étoiles, ni l'argent** : c'est un regard
bienveillant sur l'année, qui donne une raison de bien jouer en Détente sans jamais punir.

### 17.2.1 Les cinq critères *(réglés par la simulation, 2026-10-03 : voir les barèmes finaux sous les tableaux)*

**Niveaux (Détente)** — compteurs de l'année de la partie :

| Critère (couleur) | Mesure | 2 lanternes | 3 | 4 |
|---|---|---|---|---|
| **Variété** (vert) | `v` = cultures différentes récoltées + produits différents vendus ; `k` = cultures de la partie (sans les graines rares) + recettes des ateliers proposés | `v ≥ ⌈0,4 k⌉` | `≥ ⌈0,6 k⌉` | `≥ ⌈0,8 k⌉` |
| **Soin** (bleu) | part des récoltes **soignées** : arrosée chaque jour où il le fallait depuis le semis (soin du lot 2 ; arbres : toujours) ou récolte belle / dorée | ≥ 25 % | ≥ 45 % | ≥ 70 % |
| **Voisinage** (rose) | points : commande livrée 1, caisse pleine 1, fête jouée 2, ♥ des paniers de Noël 1, veillée de Joseph 1 | ≥ 8 | ≥ 16 | ≥ 26 |
| **Beauté** (jaune) | points : décoration posée 1 (8 au plus), allée choisie 1, clôture choisie 1, ruche 1 (3 au plus), pommier adulte 1 (3 au plus), 5 tournesols récoltés 1, légume géant récolté 1, mangeoire remplie 3 jours 1, 3 oiseaux différents 1 | ≥ 3 | ≥ 7 | ≥ 12 |
| **Prospérité** (orange) | argent final, comparé aux seuils d'étoiles Détente du niveau (★★ = `s2`, ★★★ = `s3`) | ≥ ½ `s2` | ≥ `s2` | ≥ `s3` |

Exemples (niveau 1, `k` = 7) : variété 3 / 5 / 6 cultures ou produits ; niveau 12 (`k` = 18) : 8 / 11 / 15.

**Barèmes finaux des niveaux** *(réglés, 2026-10-03 ; `src/data/cozy.js` fait foi)* : variété `⌈0,5 k⌉` / `⌈0,75 k⌉` /
`⌈0,95 k⌉` (niveau 1 : 4 / 6 / 7 ; niveau 12 : 9 / 14 / 18) ; soin 30 / 50 / 67 % ; voisinage 12 / 17 / 21 points ;
beauté 4 / 7 / 9 points ; prospérité inchangée (½ ★★, ★★, ★★★).

**Carrière** — compteurs de l'année (remis à zéro au bilan) :

| Critère | Mesure | 2 | 3 | 4 |
|---|---|---|---|---|
| **Variété** | cultures + produits transformés + produits animaux différents de l'année | ≥ 5 | ≥ 9 | ≥ 13 |
| **Soin** | `c` = récoltes **à la main** soignées ÷ toutes les récoltes (équipe et machines comprises) ; `a` = valeur ramassée ÷ (ramassée + perdue dans les abris pleins) ; soin = moyenne de `c` et `a` (seulement `c` sans abri à ramasser) | ≥ 35 % | ≥ 55 % | ≥ 75 % |
| **Voisinage** | commande 1, caisse pleine 1, quête de Joseph réussie 3, fête jouée 2 (calendrier et thème), ♥ des paniers 1, visiteur du thème accueilli 2, veillée 1 | ≥ 10 | ≥ 20 | ≥ 32 |
| **Beauté** | décoration posée dans la ferme 1 (12 au plus), allée et clôture choisies 1 + 1, ruche 1 (4 au plus), arbre adulte 1 (4 au plus), embellissement 2, géant récolté 1, mangeoire 3 jours 1, 3 oiseaux 1, chat ou chien 1 | ≥ 4 | ≥ 9 | ≥ 15 |
| **Prospérité** | croissance du patrimoine de l'année : (fin − début) ÷ max(début, 1 000) | ≥ 10 % | ≥ 25 % | ≥ 50 % |

**Barèmes finaux de la carrière** *(réglés, 2026-10-03)* : variété 10 / 14 / 16 ; soin 65 / 74 / 80 % ; voisinage 9 / 16 / 19 ;
beauté 8 / 13 / 15 ; prospérité 30 % / 65 % / 250 % (la croissance d'une jeune ferme est grande : la 4ᵉ lanterne reste rare).
*(Vallée vivante, lot V1, 2026-10-03 : variété **11 / 16 / 18**, beauté **14 / 19 / 21** — aménagements nature + 1 chacun,
6 au plus, paon-du-jour + 1 ; `docs/VALLEE.md` § 12.7.)*
« Embellissement » (beauté, carrière) : un décor posé au coin d'un terrain acheté.

Le « soin » de la carrière ne compte que les récoltes **à la main** : une ferme qui tourne seule a de belles récoltes,
mais pas « soignées par le fermier » (principe F1, § 17.3) ; ramasser les abris à temps (soi-même ou par l'équipe) compte
pour les bêtes.

**Règle de calibrage** (simulation, § 17.8) : pour chaque critère, le joueur tranquille obtient 1 lanterne dans ≤ 25 %
des années, 2 dans 40 à 50 %, 3 dans 25 à 35 %, 4 dans 5 à 15 % ; le joueur appliqué (robot `optimal` qui joue les fêtes)
obtient 3 ou 4 partout sauf la beauté (qui dépend du décor acheté en écus). Total médian du tranquille ≈ 11 / 20.

### 17.2.2 Le soir des lanternes (fenêtre)

- **Niveaux** : la fenêtre de victoire gagne une page « **Les lanternes de l'année** » après le bilan (et la page des
  défis du lot 3) ; en cas de faillite (Détente, rare), la page s'affiche aussi, avec « L'an prochain, ça ira mieux ».
- **Carrière** : page du bilan de l'année, entre le bilan chiffré et « L'an prochain : … » (thème du lot 3).
- Une ligne par critère (≥ 64 px) : icône, nom, 4 lanternes (allumées / éteintes, dessin + nombre lu « 3 lanternes sur
  4 », jamais la couleur seule), une mesure courte (« 6 cultures différentes ») et, s'il en manque, **un seul conseil
  doux** (« Encore 1 culture pour la 4ᵉ lanterne », « Les paniers de Noël réchauffent le voisinage »). Aucun mot négatif,
  jamais de rouge. En haut : « 13 lanternes · nouveau record ! » le cas échéant. Animation : les lanternes s'allument une
  à une (mouvements réduits : toutes d'un coup), petit carillon.
- **Scène** : un **porte-lanternes** en bois sur le perron de la maison (5 colonnes × 4 lanternes, couleurs des
  critères) montre, en niveaux, le **meilleur** résultat du niveau (progression) et, en carrière, l'**année passée** ;
  les lanternes allumées brillent doucement le soir.
- **Choix du niveau** : chaque carte de niveau affiche « 🏮 13 / 20 » (meilleur total), à côté des étoiles.
- **Carnet** (carrière) : section « Les lanternes » (années précédentes en petites colonnes, meilleure année).

### 17.2.3 Récompenses (cosmétiques seulement)

- **Écus** : niveaux : `max(0, total − meilleur total précédent du niveau)` (la première fois : `total − 5`) ;
  carrière : `⌊(total − 5) ÷ 2⌋` chaque année (0 à 7). Le meilleur total par niveau est gardé dans la progression.
- **Décors** : la première fois qu'un critère a 4 lanternes (n'importe quel mode) → sa lanterne de couleur
  (`lantern.green`, `lantern.blue`, `lantern.pink`, `lantern.yellow`, `lantern.orange`) ; la première année à 20 / 20 →
  « Le grand lampion » (`lantern.grand`).
- Succès : « Une année lumineuse » (15 lanternes), « Toutes les lanternes » (20) (§ 17.7.2).

## 17.3 F1 — Aider sans remplacer (carrière)

**Constat** (analyse, `1-analyse-du-jeu.md` § 1 et § 3.4) : une fois mécanisée, la ferme de carrière gagne seule
(+5 500 et +6 300 pièces par an sur 3 années sautées sans rien toucher, comice gagné en dormant) ; le joueur tranquille
simulé ne récolte plus à la main que **2 à 5 %** de ses récoltes à partir de l'an 4 et fait 2,5 à 4,8 gestes par jour ;
la prime « à la main » (+10 %) est trop faible et invisible. **Mesure de référence au simulateur** (8 carrières, ferme
construite par le joueur tranquille pendant 3 ans puis **laissée seule** 4 ans, robot `handsOff`) : bénéfice
**≈ +3 000 pièces par an** (revenu ≈ 4 900, dont cultures ≈ 2 500 récoltées par l'équipe et les machines, animaux
≈ 1 350, miel ≈ 320, produits ≈ 450), sans faillite. Le robot `automator` (aucun geste dès l'an 3) arrive au Domaine à
l'an 6 et à 262 000 de patrimoine à l'an 10 — autant que le joueur tranquille.

**Principe** (décision de l'utilisateur) : les salariés et les machines font les **corvées** (arroser, désherber, semer,
ramasser les abris, chasser les corbeaux) ; le **moment gratifiant** — la récolte — revient d'abord au joueur, et vaut
plus quand il la fait. Rien ne reste jamais bloqué : l'équipe finit toujours par récolter.

### 17.3.1 Règles chiffrées

| # | Règle | Avant | Lot 4 |
|---|---|---|---|
| F1-1 | **Prime « Cueilli main »** : une récolte touchée par le joueur (toucher ou glisser) | + 10 % | **+ 25 %** (`HAND_BONUS` 1,25), toujours affichée : texte flottant « +31 ♥ », fiche de la parcelle « À la main : 31 · par l'équipe : 25 » ; *(livraison)* la prime est **payée tout de suite même si la récolte part au grenier, à l'atelier ou à une commande** (comme la prime de qualité du lot 2) : récolter soi-même vaut toujours plus |
| F1-2 | **La récolte vous attend** : une culture (ou des fruits) mûre attend le joueur avant que l'équipe la récolte | aucune attente (géant : 3 aubes) | **moissonneuse et cueilleuse : à partir de la 3ᵉ aube** après la maturité *(réglé : 2ᵉ aube dans la conception, voir § 17.3.2)* ; **jardiniers : à partir de la 4ᵉ aube** ; géant : inchangé (3 aubes) |
| F1-3 | **Les jardiniers font les corvées** : ordre des tâches | corbeau > récolter > arroser > semer | corbeau > arroser > **désherber** > semer > récolter (seulement ce qui attend depuis 4 aubes) |
| F1-4 | **Désherber** (nouvelle corvée, jardiniers seulement) : une fois par culture en pousse | — | la culture « désherbée » donne, à sa récolte **à la main**, + 1 point de chance « belle » et + 0,3 point « dorée » (s'ajoute aux soins du lot 2 ; fiche : « Désherbée par Lucie ») ; sans effet sur une récolte de l'équipe ; 1 action, 1 point d'expérience |
| F1-5 | **Comice** : épreuves de récolte (citrouilles, tomates, pommes de terre, paniers de fruits, « N récoltes ») | toutes les récoltes comptent | **seulement les récoltes à la main** (« le jury veut voir le travail du fermier ») ; les autres épreuves (produits, fromages, œufs, truffes, stock) sont inchangées ; + le stand du comice (§ 17.4.3) |
| F1-6 | **Lanternes** : le « soin » ne compte que les récoltes à la main (§ 17.2.1) | — | — |

Précisions :
- **Maturité** : une culture mûrit à l'aube (pousse) ; le cœur note le jour absolu `ripeAt`. Machines : récolte permise
  si `jour − ripeAt ≥ 3` (`F1.machineDelay`) ; jardiniers : `≥ 4` (`F1.staffDelay`). La 3ᵉ aube laisse donc au joueur la
  journée de maturité **et** les deux suivantes (≈ 1 min à ×1).
- **Exception « rien ne se perd »** : le **dernier jour de l'automne**, l'équipe récolte tout de suite ce qui gèlerait
  au 1er jour d'hiver (et la serre n'est pas concernée par le gel : la règle normale s'y applique).
- Le **semoir** et les **arroseurs** sont inchangés (corvées) ; les **collecteurs** et **soigneurs** aussi (ramasser
  est une corvée) ; les ateliers et le grenier aussi.
- Les **récoltes de l'équipe** sont payées au prix normal (comme avant) ; aucune récolte n'est jamais perdue : une
  culture mûre attend sans pourrir.
- **Interface** : fiche d'une parcelle mûre : « Vous attend · la moissonneuse passera dans 1 jour » ; ligne « À faire » :
  « Le Haut-Champ : 12 parcelles mûres vous attendent (+25 % à la main) » (un toucher amène la vue, le glisser récolte) ;
  résumé du matin : « Hier : 34 récoltes à la main (+86 de prime) » ; fiche de l'équipe : « Jardinier : arrose,
  désherbe, sème, chasse les corbeaux ; récolte ce qui attend depuis 4 jours » ; moissonneuse : « Récolte ce qui attend
  depuis 3 jours ». Conseil « première fois » `cozy.helpers` à la première culture mûre d'un terrain équipé : « Vos
  récoltes vous attendent : l'équipe ne les cueille qu'après 3 à 4 jours. À la main, elles valent 25 % de plus ! »
  (textes calculés à partir de `F1` et `HAND_BONUS`).
- Rendu : jardinier accroupi qui arrache une touffe (`fx.weeds`) ; badge discret « ♥ » sur les parcelles mûres qui
  attendent ; texte flottant de la prime en vert.

### 17.3.2 Ce que la règle change (prototype au simulateur, 2026-10-03)

Mesuré sur une copie de travail du code (prototype jetable des règles F1-1 et F1-2, sans le désherbage ni le comice ;
8 carrières × 10 ans, Détente, saisons de 7 jours ; le joueur tranquille simulé récolte d'abord à la main ce qui est mûr
dans son budget de gestes, terrain le plus mûr d'abord, et fait ses achats avant d'aller aux champs) :

| Mesure | Avant | Lot 4 (F1-1 + F1-2) |
|---|---|---|
| **Ferme laissée seule** (`handsOff` : ans 4 à 7) : bénéfice par an | ≈ + 3 000 | **≈ + 950** (− 68 %), jamais négatif, 0 faillite |
| Joueur tranquille : revenu cumulé sur 10 ans | 293 200 | 287 400 (**− 2 %**) |
| Joueur tranquille : rang médian par année · Domaine (médiane) | 2 2 3 4 4 5 5 6 6 6 · an 8 | 2 2 3,5 4 5 5 5 6 6 6 · **an 8** |
| Joueur tranquille : patrimoine à l'an 10 | 199 900 | 194 400 (− 3 %) |
| Joueur tranquille : **part des récoltes à la main** (ans 5 à 10) | 2 à 5 % | **69 à 91 %** |
| Joueur tranquille : gestes par jour (ans 5 à 10) | 2,5 à 4,8 | **≈ 8** |
| `automator` (aucun geste dès l'an 3) : Domaine · patrimoine à l'an 10 | an 6 · 262 000 | **an 7 · 184 000** (− 30 %) |
| Débutant (suit la ligne « À faire » des champs mûrs) : rang 3 à l'an 5 · patrimoine an 10 | oui · 115 000 | oui · 88 000 à 94 000 (− 20 %) |

Variantes essayées : jardiniers à 3 aubes (ferme seule − 40 % seulement) ; jardiniers qui ne récoltent jamais (même
effet que 4 aubes, mais un champ peut rester plein des semaines) ; récolte des machines vendue « en vrac » × 0,85
(n'apporte presque rien de plus et ressemble à une punition) : **retenu : 2 aubes / 4 aubes, sans vrac**.

#### 17.3.3 Réglage final (simulation complète, 60 carrières × 10 ans, 2026-10-03)

Code complet (F1-1 à F1-5, désherbage, comice, fêtes et hiver), robot tranquille **corrigé** : ses achats se font avant
d'aller aux champs et ne coûtent plus de gestes de champ (il ne s'agrandissait plus faute de gestes), il récolte d'abord à
la main, terrain le plus mûr d'abord ; serre (rang 2) et mare (rang 3, + 2 canards) dans sa liste d'envies. Le débutant
suit la ligne « À faire » des champs mûrs (tout ce qui est mûr, le plus mûr d'abord).

Ce qui a changé par rapport au prototype :
- **Prime à la main payée même quand la récolte part au grenier ou à l'atelier** : sans elle, le joueur tranquille (grenier
  « cours bas ») perdait la prime sur la moitié de ses récoltes et F1 lui coûtait ≈ 4 % de revenu ; avec elle, F1 lui
  **rapporte** ≈ + 4 %.
- **Moissonneuse et cueilleuse à la 3ᵉ aube** (levier n° 2 du § 17.8) : la ferme du tranquille corrigé est bien plus
  mécanisée à l'an 3 que celle du prototype (cultures ≈ 75 % du revenu d'une ferme laissée seule, presque toutes
  récoltées par la moissonneuse) ; la 2ᵉ aube ne retirait que 30 % de son bénéfice. 3ᵉ aube : − 36 %, et plus de
  temps pour le joueur. Au-delà (4ᵉ, 6ᵉ aube), le gain plafonne (− 42 %, − 46 %) : le reste du bénéfice vient des bêtes,
  du miel et des ateliers, que l'équipe continue de ramasser (corvées : principe F1).

| Mesure (`--compare-f1` : fêtes et hiver des deux côtés ; `--compare-cozy` : tout le lot) | Sans F1 / sans le lot | Avec | Cible |
|---|---|---|---|
| **Même ferme laissée seule** (construite 3 ans sans F1, puis ans 4 à 7) : bénéfice par an | + 7 660 | **+ 4 870 (− 36 %)** | ≤ 50 % d'avant : **non tenue** (voir ci-dessus) |
| Ferme laissée seule (`handsOff`, carrières jouées séparément) : bénéfice par an (ans 4 à 7) | + 10 520 | + 7 250 (− 31 %) | idem ; jamais de faillite ✓ |
| Tranquille : revenu sur 10 ans (F1 seul · tout le lot) | 285 800 · 282 700 | 297 100 (+ 3,9 % · **+ 5,1 %**) | − 1 à + 5 % (à la limite) |
| Tranquille : rang médian par année · Domaine | 2 2 4 4 4 5 5 6 6 6 · an 8 | 2 2 4 4 5 5 5 6 6 6 · **an 8** | à un an près ✓ |
| Tranquille : patrimoine moyen à l'an 10 (tout le lot) | 188 100 | 208 200 (+ 10,6 %) | — |
| Tranquille : part des récoltes à la main · gestes par jour (ans 5 à 10) | 2 % · 2 | **92 % · 8** | ≥ 50 % · 6 à 10 ✓ |
| Tranquille : comice (gains sur 10 ans) | 13 660 | 13 970 (stand compris) | ≥ 90 % ✓ |
| `automator` : Domaine · patrimoine moyen à l'an 10 | an 7 · 245 800 | **jamais · 146 300 (− 40,5 %)** | pas avant l'an 7 · − 25 % ✓ |
| Débutant : rang 3 à l'an 5 · patrimoine moyen à l'an 10 (F1 seul) | 100 % · 128 200 | 100 % · **137 600 (+ 7 %)** | ≥ 70 % ✓ · perte ≤ 10 % ✓ |
| Appliqué (`optimal`) : revenu · Domaine (tout le lot) | 419 300 · an 6 | 528 800 (+ 26 %) · an 5 | — (il récolte tout à la main) |
| Carrière Classique, tranquille : faillites | 0 % | 0 % | ≤ 20 % ✓ |

Le débutant ne perd plus rien (il gagnait − 20 % de patrimoine dans le prototype) : la prime payée même au grenier et la
récolte « à la ligne À faire » suffisent ; aucun autre levier n'a été nécessaire.

## 17.4 C6 — Les fêtes participatives

Les fêtes deviennent des **moments à jouer** (et plus seulement des multiplicateurs passifs) : chaque fête a un petit
**mini-jeu au doigt**, en portrait, **sans chrono ni échec**, qui dure une à deux minutes. Toute fête est annoncée **la
veille** (bandeau, résumé du matin, ligne « À faire ») et dure **toute la journée** ; la feuille de la fête met le jeu en
pause pendant la lecture (option du lot 1) et la chasse aux œufs **toujours** (mode fête). Ce qu'on n'a pas fait n'est
pas perdu : une petite partie est donnée par le village le soir, et la fête revient l'année suivante.

**Les ingrédients ne sont jamais consommés** : une fête puise dans « ce que la ferme a produit **cette année** »
(cultures récoltées, produits vendus, produits animaux ramassés ou rapportés), comme un souvenir de l'année. Aucun stock
à gérer, aucune perte de trésorerie.

### 17.4.1 Le calendrier

| Quand | Fête | Mini-jeu (moteur) | Niveaux (Détente) | Carrière |
|---|---|---|---|---|
| Dernier jour de l'hiver | **La foire aux graines** | boutique de sachets prépayés (`foire`) | — (l'année finit en hiver) | dès l'an 1 ; **remplace la « Foire aux semis » du printemps (jour 3)**, arrivée trop tard (les semis du jour 1 étaient faits) |
| Printemps, jour 3 | **La fête du printemps — chasse aux œufs** | trouver 8 œufs cachés dans la ferme (`chasse`) | niveaux 2 à 12 (niveau 1 : pas au printemps, tutoriel) | dès l'an 1 |
| Été, jour 4 | **La fête du village — soupe partagée** | 1 à 3 légumes dans la marmite (`marmite`) | tous les niveaux | dès l'an 1 (effets d'avant gardés : récoltes + 25 %, équipe joyeuse, chambre d'hôte × 2) |
| Automne, jour 2 | **La fête des récoltes — le stand de la ferme** | remplir 5 cagettes, jugées sur la variété et la qualité (`etal`) | tous les niveaux | dès l'an 1 (ventes + 15 % et cœur de Joseph gardés) |
| Hiver, jour 4 | **Le marché de Noël — les paniers** | 3 paniers pour 3 villageois (`paniers`) | tous les niveaux | **dès le rang 1** (avant : rang 2 ; effets d'avant gardés : produits + 50 % le matin, grenier + 25 %) |
| Fêtes de l'année à thème (lot 3) | voir § 17.4.6 | moteur selon la fête | — | inchangées (dates, effets) + un mini-jeu |

Niveaux de 5 jours d'été (niveau 11) : la fête reste au jour 4 ; hiver de 14 jours (niveau 5) : jour 4. Une fête de
niveau ne tombe jamais le même jour que l'arrivée de la charrette (jour 1) ni que Basile (jours 5 et 6).

Récompenses (pièces de la partie et écus ; **carrière : pièces × f = 1 + 0,5 × (rang − 1)**, soit × 1 au rang 1 et
× 3,5 au Domaine) :

| Fête | Niveaux | Écus |
|---|---|---|
| Chasse aux œufs | 2 pièces par œuf trouvé soi-même, 6 pour l'œuf doré ; le soir, Lili trouve les autres : 1 pièce chacun (doré : 3) | + 1 si les 8 trouvés soi-même |
| Soupe partagée | 1 / 2 / 3 louches → 6 / 12 / 20 pièces | + 1 à 3 louches |
| Stand de la ferme | ruban vert / bleu / rosette d'or → 10 / 20 / 32 pièces | 0 / 1 / 2 |
| Paniers de Noël | par panier : 3 pièces + 3 par ♥ (9 à 27 en tout) | + 1 à 6 ♥ |

Repères (niveaux) : au mieux ≈ 100 pièces et 5 écus par année ; le joueur tranquille simulé (≈ 60 % des fêtes jouées,
choix au hasard) ≈ 45 à 60 pièces, soit **≈ + 2,5 %** de revenu.

### 17.4.2 La chasse aux œufs (moteur `chasse`)

1. **La veille** : « Demain, fête du printemps : la chasse aux œufs ! ». **À l'aube du jour** : 8 œufs peints (un doré)
   sont cachés dans la ferme : au pied d'un buisson ou d'un arbre, contre la clôture, derrière un bâtiment, au bord de la
   forêt, sous le panneau, près du puits… Chaque œuf dépasse à moitié de sa cachette et fait un petit **dandinement**
   toutes les ~4 s (mouvements réduits : une étincelle immobile).
2. Ligne « À faire » : « Fête du printemps : 8 œufs à trouver » → toucher : feuille « La chasse aux œufs » (dessin,
   « 0 / 8 », bouton **« Chercher les œufs »**).
3. **Mode fête** : le jeu se met en **pause** (raison `fete`), la barre d'onglets est remplacée par une barre « 🥚 3 / 8 ·
   **Indice** · **Terminer** » ; on fait défiler la ferme au doigt ; **toucher un œuf** (cible ≥ 48 px) : il saute,
   confettis, note qui monte (comme la récolte juteuse), « +2 » ; l'œuf doré : étincelles d'or, « +6 ». Les autres
   touchers ne font rien (pas d'action de parcelle en mode fête).
4. **Indice** (illimité, sans pénalité) : la vue glisse vers l'œuf le plus proche non trouvé et une étincelle le montre
   (aide visuelle et motrice). **Terminer** : retour au jeu ; les œufs restent jusqu'au soir (on peut revenir, et un œuf
   touché en jouant compte aussi).
5. **Le soir** : les œufs non trouvés sont trouvés par **Lili et les enfants du village** : « Lili a trouvé les 3 derniers
   œufs pour vous ! » (1 pièce chacun). Aucun échec.
6. Album : case `eggHunt` au premier œuf trouvé soi-même ; tampon 🏅 si les 8 (doré compris) sont trouvés soi-même.

### 17.4.3 La soupe partagée (moteur `marmite`)

1. Feuille « La soupe du village » (haute) : grande marmite fumante en haut, phrase de Mme Chevalier (« Chacun apporte un
   légume ! Jusqu'à trois, tous différents. »), puis une grille de tuiles (≥ 72 px) : **les légumes récoltés cette
   année** (carotte, navet, blé, chou, tomate, maïs, tournesol, pomme de terre, courgette, citrouille, petits pois,
   poireau ; les fruits — fraise, pomme, melon — ne sont pas proposés), avec un badge ★ / ✦ si une belle ou une dorée de
   ce légume a été récoltée cette année, ◆ si un géant.
2. **Toucher une tuile** : le légume saute dans la marmite (« plouf », vapeur) ; toucher le légume dans la marmite l'enlève.
3. **« Goûter la soupe ! »** (actif dès un légume) : trois villageois goûtent et donnent des **louches** :
   1 louche toujours (« Une bonne soupe, merci ! ») ; 2 louches avec 2 légumes différents (« Un régal ! ») ; 3 louches
   avec 3 légumes différents **dont au moins un beau** (belle, dorée ou géant cette année) (« La meilleure soupe de
   l'année ! »). Sans les surprises du lot 2 (option) : 3 légumes suffisent.
4. Une seule soupe par fête ; pas venu : le soir, « La soupe était bonne ! On vous en a gardé un bol. » (0 pièce, aucun
   reproche).

### 17.4.4 Le stand de la ferme (moteur `etal`) — et le comice

1. Feuille « Le stand de la ferme » : un étal de **5 cagettes** (tuiles 64 px, 2 rangées) ; dessous, ce que la ferme a
   produit cette année (cultures, fruits, produits transformés, produits animaux), avec les mêmes badges de qualité.
2. **Toucher un produit** : il va dans la première cagette libre (un même produit une seule fois) ; toucher une cagette
   pleine la vide.
3. **« Présenter au jury »** (actif dès une cagette) : M. le maire passe (petite animation), carnet en main. **Points** :
   1 par cagette ; + 1 si une belle de ce produit cette année, + 2 si une dorée (au lieu de + 1) ; + 2 si un géant ;
   + 1 pour un produit fait maison (atelier) ; + 1 pour la vedette de l'année (thème, carrière).
   **Ruban** : **vert** « Coup de cœur des enfants » (toujours, dès 1 point) ; **bleu** « Bel étal » (≥ 8) ; **rosette
   d'or** « Grand prix du jury » (≥ 12). Exemples : 5 légumes ordinaires = 5 (vert) ; 2 belles + 1 confiture + 2 légumes = 8
   (bleu) ; 3 dorées + 2 produits = 13 (or).
4. **Carrière — le comice** : le stand présenté à la fête des récoltes (automne, jour 2) est **gardé** et présenté de
   nouveau au comice (soir du dernier jour d'automne) : rosette d'or → **+ 50 % du prix d'une épreuve**, ruban bleu →
   **+ 25 %**, vert → rien de plus (prix d'une épreuve : 100 × rang, × 2 au Domaine). Les épreuves de récolte du comice
   ne comptent plus que les récoltes à la main (F1-5).

### 17.4.5 Les paniers de Noël (moteur `paniers`)

1. Feuille « Les paniers de Noël » : **3 villageois** (tirés parmi les 12 clients du tableau, flux `cozy`), chacun avec
   son portrait (48 px), son nom et ce qu'il **aime** (3 icônes : ses cultures préférées du lot 3 et un produit, table
   ci-dessous) ; un panier vide (2 places) sous chacun ; dessous, ce que la ferme a produit cette année.
2. **Toucher un panier**, puis **deux produits** (ou toucher un produit : il va dans le premier panier qui a une place).
3. **« Offrir les paniers »** : chaque villageois remercie ; **♥** pour chaque produit qu'il aime (0 à 2 par panier),
   jamais de reproche (« Merci, c'est trop gentil ! » à 0 ♥, « Oh, mes préférés ! » à 2 ♥).

4. *(intégration, 2026-10-03)* Une ferme qui n'a produit que 1 ou 2 choses cette année offre autant de paniers garnis
   que de produits différents ; le dernier villageois reçoit un « Joyeux Noël ! » (aucun reproche, pas de pièces pour lui).

Produit aimé en plus des cultures préférées (lot 3) : Rose → confiture de fraises ; Paulo → pain ; Lili → œufs ;
Garnier → lait ; Chevalier → fromage de vache ; Fabre → œufs (œufs durs du pique-nique) ; Perrin → jus de pomme ; le maire → fromage de chèvre ;
Odette → confiture de fraises ; Léon → jus de pomme ; Morel → laine ; les jumeaux → pain.

### 17.4.6 Les fêtes des années à thème (carrière, lot 3)

Leurs dates et leurs effets ne changent pas ; chacune gagne un mini-jeu qui réutilise un moteur, avec son décor :

| Fête du thème | Moteur | Variante |
|---|---|---|
| Fête du miel (abeilles) | `marmite` | « La tarte au miel » : fruits et légumes sucrés acceptés (fraise, pomme, melon, citrouille, carotte) |
| Foire aux fromages (fromage) | `etal` | fromages : + 2 points chacun |
| Nuit des lampions (tourisme) | `chasse` | 8 lampions à allumer dans la ferme (un toucher les allume, ils restent allumés la nuit) |
| Concours du plus gros légume (géants) | `etal` | un géant : + 4 points au lieu de + 2 |
| Bal des grenouilles (grenouilles) | `chasse` | 8 grenouilles cachées près des mares, des fossés et des parcelles arrosées |
| Fête de la pomme (vergers) | `etal` | paniers de pommes et jus : + 2 points chacun |
| Fête du pain (pain) | `marmite` | « Le pain du village » : du blé obligatoire + 2 ingrédients (graines de tournesol, citrouille, pomme…) |
| Grand marché (grands marchés) | `etal` | 6 cagettes au lieu de 5 |
| Fête des lumières (lumières) | `chasse` | 8 lanternes à allumer (sous la neige) |

Récompenses : celles du moteur (§ 17.4.1) × f ; album : tampon 🎪 de la case de l'année (§ 17.1.2, page 7).

### 17.4.7 La foire aux graines (carrière, dernier jour de l'hiver)

- Feuille « La foire aux graines » : **3 étals** (défilement horizontal, une carte ≥ 72 px par sachet) : *Graines du pays*
  (cultures du rang qui se sèment au printemps), *Plants* (pommier, si un verger existe), *Le sachet de Basile* (3 graines
  rares de petits pois, seulement si Basile est déjà passé une fois). Un **sachet** = **8 semis prépayés** à **− 25 %** du
  prix du printemps (pommier : 1 plant à − 25 %) ; 4 sachets au plus par culture, 20 en tout.
- Les sachets vont à la **réserve de graines** (`seedBank`) : tout semis de cette culture (joueur, jardinier, semoir) la
  prend d'abord, **sans payer** ; la réserve ne se périme jamais. Feuille des graines : « Réserve : 16 » sur la ligne.
- C'est aussi le moment de **préparer le printemps** : la feuille propose « Mon carnet de semis » (le plan de culture
  des champs, existant) ; ligne « À faire » de l'hiver : « Préparez le printemps : foire aux graines le 7ᵉ jour ».

## 17.5 C8 — L'hiver vivant

L'hiver garde son rôle (les cultures d'été gèlent, les réserves et les animaux font vivre la ferme), mais gagne de
**petites activités douces**, toutes optionnelles, qui ne rapportent presque rien en argent et beaucoup en album, en
lanternes et en atmosphère. Niveaux (Détente) et carrière.

### 17.5.1 La cueillette d'hiver (lisière)

- À chaque aube d'hiver, **une trouvaille** apparaît en lisière (bord de la forêt, haies, fossés, chemin), avec une
  petite étincelle ; **3 au plus** à la fois ; elles **restent** jusqu'à ce qu'on les ramasse (ou jusqu'à la fin de
  l'hiver). Toucher (cible ≥ 48 px) = ramasser : la trouvaille saute dans le panier, « +3 ».
- Tirage (flux `cozy`) :

| Trouvaille | Poids | Pièces (niveaux ; carrière × f) |
|---|---|---|
| Bois mort | 3 | 2 |
| Pommes de pin | 3 | 2 |
| Houx | 2 | 3 |
| Châtaignes | 2 | 4 |
| Pieds-bleus | 2 | 5 |
| Gui | 1 | 6 |

- **Jour de neige** : en plus, 40 % de chances d'une **trace** dans la neige (lièvre 2, chevreuil 1, renard 1) : rien à
  gagner, une case d'album, et la trace se voit jusqu'au soir (petit dessin sur la neige).
- Repère : un hiver de 7 jours ≈ 20 pièces si l'on ramasse tout (niveau 5, 14 jours : ≈ 40).
- Carrière : seul le joueur ramasse (aider sans remplacer ; l'équipe n'y touche pas).

### 17.5.2 La mangeoire

- À la 1re aube d'hiver, une **mangeoire** apparaît près de la maison (niveaux : dans la cour ; carrière : bande de la
  maison). **Toucher = la remplir** (gratuit, une fois par jour ; graines qui tombent).
- Le lendemain d'un remplissage, **un oiseau** vient à l'aube (tirage `cozy`) et reste la journée (toucher : il chante) :
  moineau 4, mésange charbonnière 4, rouge-gorge 3, mésange bleue 3, pinson 3, sittelle 2, bouvreuil 1 (après 3
  remplissages dans l'hiver), pic épeiche 1 (après 5) ; un oiseau **jamais vu** a un poids × 2.
- Aucun argent : une case d'album, des points de beauté (lanternes) et un peu de vie dans la cour.

### 17.5.3 Les veillées de Joseph

- À l'aube du **3ᵉ jour d'hiver** : « Ce soir, veillée chez Joseph » (résumé du matin, ligne « À faire » ; la fenêtre de
  la maison s'éclaire dans la scène). **Joseph attend quand on veut, tout l'hiver** (pas seulement ce soir).
- Toucher la ligne ou la fenêtre : feuille « La veillée » : vignette au coin du feu, titre, 3 courtes lignes de l'histoire
  suivante (ordre fixe, 12 histoires, progression permanente partagée par les deux modes), bouton « Bonne nuit, Joseph ».
  **+ 1 écu** par histoire nouvelle ; après la 12ᵉ, Joseph raconte de nouveau une histoire déjà entendue (sans écu).
- Les histoires parlent de la vallée d'autrefois (haies, ruisseau, écrevisses, cigognes, graines de sa mère) : elles
  **annoncent** la Vallée vivante (§ 17.9) sans rien promettre de précis.

### 17.5.4 Carrière : serre et mare plus tôt, préparer le printemps

| Changement | Avant | Lot 4 |
|---|---|---|
| Serre (aménagement) | rang 3, 800, « bientôt » affiché | **rang 2, 500**, plus de « bientôt » |
| Mare (aménagement) et canards | rang 4, 400 | **rang 3, 300** ; la pêche (une fois par jour) marche aussi l'hiver (« pêche sous la glace », mêmes poissons) |
| Foire aux semis (printemps, j. 3, graines − 25 %) | — | devient la **foire aux graines** du dernier jour d'hiver (§ 17.4.7) |
| Rappel d'hiver | — | ligne « À faire » : « Préparez le printemps : carnet de semis, foire aux graines » |

Les cultures d'hiver de la serre (× 0,5 au niveau 1, hors saison × 1,25) restent **le** revenu d'hiver des fermes
avancées ; elles arrivent un an plus tôt pour le joueur tranquille (serre attendue en fin d'an 2 au lieu de l'an 4).

## 17.6 Activation par mode, sauvegardes

| Partie du lot | Niveaux Classique | Niveaux Détente | Carrière (Détente et Classique) |
|---|---|---|---|
| **Album** (D1) | **oui**, hors partie : cases lues dans ce que la partie expose déjà (cultures, produits, animaux, temps du jour), à l'aube et au bilan de fin | oui | oui |
| **Lanternes** (D3) | non (le Classique a ses étoiles) | oui | oui |
| **Fêtes** (C6) | non | oui | oui |
| **Hiver vivant** (C8) | non | oui | oui (+ serre et mare plus tôt, foire aux graines) |
| **Aider sans remplacer** (F1) | — | — | oui |

**Pourquoi l'album peut se remplir en Classique** : il ne vit pas dans l'état de la partie (`state`) mais dans la
progression permanente (`progress.album`), comme les cumuls et les succès qui se remplissent déjà en Classique. Le cœur
n'y gagne **aucun** champ d'état, **aucun** tirage, **aucun** événement : seule la requête de lecture
`query.achievementContext()` expose en plus le temps du jour (`weather`), ce qui ne touche ni l'état ni la parité. Les
cases liées aux lots 2 à 4 (dorées, géants, surprises, météos spéciales, villageois, fêtes, hiver) ne se trouvent
simplement pas en Classique (indice « En Détente ou dans Ma ferme »). Les récompenses de l'album sont des écus et des
décors, sans effet sur le jeu.

- **Options** : `createGame({ cozy })` : défaut activé en Détente, **clé absente en Classique** ; `createCareer({ cozy })` :
  défaut activé ; on peut désactiver une partie (`{ lanterns, fetes, winter, helpers }`) pour les tests et la simulation.
  Pas d'interrupteur dans l'interface (point ouvert).
- **Sauvegardes** :
  - partie de niveau **Détente** d'avant le lot 4 : le lot s'active à la reprise ; la prochaine fête a lieu à sa date si
    elle n'est pas passée ; les compteurs des lanternes commencent à zéro → les lanternes de cette année-là sont
    calculées sur ce qui reste (« Année commencée avant les lanternes » écrit sous le total ; elles comptent quand même
    pour le meilleur total) ;
  - partie **Classique** : rien ne change (album seulement, hors partie) ;
  - **carrière** : le lot s'active à la reprise ; F1 tout de suite, mais les cultures **déjà mûres** au chargement
    reçoivent `ripeAt` = aujourd'hui − 4 (l'équipe peut les récolter tout de suite : aucun champ ne s'arrête par
    surprise) ; la foire aux graines au prochain dernier jour d'hiver ; lanternes de l'année en cours sur ce qui reste ;
    serre et mare : nouveaux rangs et prix (un terrain déjà aménagé ne change pas).
  - **progression** : `album`, `lanterns` et `lifetime.cozy` ajoutés par `normalizeProgress` (schéma inchangé) ; le
    rattrapage (§ 17.1.4) une seule fois.
- **Tutoriel du niveau 1** : pas de fête au printemps ; première fête en été ; conseils « première fois » : `cozy.album`
  (première case), `cozy.fete` (première fête annoncée), `cozy.winter` (premier hiver), `cozy.lanterns` (premières
  lanternes), `cozy.helpers` (carrière, § 17.3.1), `cozy.seedFair` (carrière, première foire).

## 17.7 Cas limites, succès

### 17.7.1 Cas limites

- **Fête et autre fenêtre** : la feuille de fête ne s'ouvre jamais seule ; elle attend que rien d'autre ne soit ouvert.
  Le mode fête (chasse) s'interrompt si une fenêtre importante arrive (fin de saison, victoire) : les œufs restent.
- **Fête un jour de fin de partie** : la chasse se termine au soir comme d'habitude ; une fête n'a jamais lieu après la
  victoire.
- **Rien produit cette année** (soupe en été d'une ferme qui n'a rien récolté, stand vide) : la feuille le dit
  (« Récoltez un légume, et revenez goûter ! ») ; on peut revenir plus tard dans la journée.
- **Fête de carrière pendant un coup dur** : rien ne change (la fête ne coûte rien).
- **Chasse aux œufs en carrière avec une grande carte** : les cachettes sont choisies dans la bande de la maison, le champ
  de départ et les terrains achetés **proches** (voisins de la maison) ; l'indice amène toujours la vue.
- **Paniers** : un villageois sans produit aimé dans la production de l'année reçoit quand même son merci (0 ♥).
- **Hiver de 14 jours** (niveau 5) : 14 trouvailles au plus (3 à la fois), mangeoire chaque jour, une seule veillée.
- **Saison d'hiver de carrière à 10 ou 14 jours** : foire aux graines au dernier jour, veillée au jour 3.
- **F1, terrain sans joueur** (le joueur ne vient jamais) : la moissonneuse récolte à partir de la 3ᵉ aube, les
  jardiniers de la 4ᵉ ; un champ ne reste jamais plein plus de 4 jours.
- **F1 et commandes / charrette / quêtes** : inchangé (seule la récolte à la main les remplit, comme au lot 3).
- **F1 et le géant** : règle du lot 2 (3 aubes) ; le désherbage ne s'applique pas au géant.
- **F1 et la serre en hiver** : même règle ; pas d'exception de gel (pas de gel dans la serre).
- **Lanternes sans surprises** (option `surprises: false`) : le soin compte seulement « arrosée chaque jour » (sans
  belles ni dorées) ; si même cela manque (partie migrée), le soin vaut 2 lanternes.
- **Album et « Effacer la progression »** : vidé avec le reste (texte de confirmation).
- **Album, case indécidable en Classique** (ex. pommes de terre sans Semencier aux niveaux 1 à 8) : la case reste
  trouvable ailleurs ; l'indice le dit.

### 17.7.2 Succès du lot (écus seulement, catégorie « Album et fêtes » de la grange)

| id | Nom | Condition | Écus |
|---|---|---|---|
| `albumPage` | Première page | compléter une page de l'album | 10 |
| `goldenHerbarium` | Herbier doré | page dorée du potager (★ sur les 15 cultures) | 30 |
| `albumComplete` | Album complet | les 11 pages | 50 |
| `brightYear` | Une année lumineuse | 15 lanternes en une année | 15 |
| `allLanterns` | Toutes les lanternes | 20 lanternes en une année | 40 |
| `eggHunter` | Chasseur d'œufs | trouver soi-même les 8 œufs d'une chasse | 10 |
| `goldRosette` | Grand prix du jury | une rosette d'or au stand | 15 |
| `birdFriends` | Les amis à plumes | les 8 oiseaux de la mangeoire | 15 |
| `handPicked500` | Les mains dans la terre | 500 récoltes à la main en carrière (cumul) | 20 |
| `orders50` | Ami du village | 50 commandes du tableau livrées (cumul ; point ouvert du lot 3) | 20 |
| `fullCart` | Charrette pleine | toutes les caisses d'une charrette (lot 3) | 10 |
| `goldMedals10` | Dix médailles d'or | 10 médailles d'or de défi (cumul, lot 3) | 20 |

Total 255 écus. Aucune étoile (la monnaie des bonus du mode Niveaux ne change pas).

## 17.8 Équilibre (cibles à vérifier par la simulation)

Commandes (à créer, § ARCHITECTURE) : `node tools/simulate.js --compare-cozy [--strategy casual]` (sans → avec, même
graine ; surprises et variété actives des deux côtés), `node tools/simulate.js --lanterns` (répartition des lanternes
par robot et par critère), `node tools/simulate.js --stars` (seuils d'étoiles), `node tools/simulate-career.js
--compare-cozy` et `--compare-f1` (robot `handsOff`).

Robots (par l'API publique, leurs propres tirages) : le **tranquille** joue une fête sur ses jours de jeu avec
60 % de chances (choix au hasard parmi ce qui est proposé : 2 légumes, 3 à 5 cagettes, paniers au hasard), trouve 5 à 8
œufs, ramasse une trouvaille d'hiver une fois sur deux, remplit la mangeoire un jour sur deux, écoute la veillée ; en
carrière, il **récolte d'abord à la main** ce qui est mûr (terrain le plus mûr d'abord) dans son budget de gestes, et ses
achats ne coûtent pas de gestes de champ ; le **débutant** joue 30 % des fêtes, suit la ligne « À faire » des champs mûrs ;
l'**appliqué** joue tout, au mieux ; `handsOff` (nouveau) = tranquille les ans 1 à 3, puis plus rien ; `automator` et
`idle` inchangés. Les robots scriptés de la parité (Classique) ne changent pas.

| Mesure | Cible |
|---|---|
| Niveaux (Détente, 200 parties par niveau) : revenu de l'année du tranquille | **+ 2 à + 5 %** (fêtes ≈ + 2,5 %, hiver ≈ + 1 %) ; débutant ≤ + 4 % ; appliqué ≤ + 6 % |
| Niveaux : victoires | inchangées ou meilleures (cibles du § 13.6) |
| Niveaux : seuils d'étoiles Détente | **recalculés** selon la règle du § 13.3 (attendu : argent final médian du tranquille + 10 à + 25 %, donc seuils relevés d'autant ; valeurs exactes dans `src/data/difficulty.js` et le tableau du § 13.3) |
| Lanternes | règle de calibrage du § 17.2.1 ; total médian du tranquille ≈ 11 / 20, appliqué ≥ 16 / 20 |
| Écus par année (fêtes + lanternes + veillée) | ≈ 3 à 8 (lot 3 : 6,5 à 11) |
| Classique (niveaux) | **identique** (parité ; l'album ne change rien à la partie) |
| Carrière, ferme laissée seule (`handsOff`, ans 4 à 7) | bénéfice par an **≤ 50 %** d'avant (attendu ≈ − 65 % : + 3 000 → + 1 000), jamais de faillite, argent jamais négatif deux saisons de suite |
| Carrière, `automator` | Domaine (médiane) **pas avant l'an 7** ; patrimoine à l'an 10 **− 25 % ou plus** |
| Carrière, tranquille (60 carrières × 10 ans) | revenu sur 10 ans **− 1 à + 5 %** ; rang médian par année identique **à un an près** ; Domaine (médiane) à un an près ; part des récoltes à la main ans 5-10 **≥ 50 %** ; gestes par jour ans 5-10 **6 à 10** (le joueur revient aux champs sans corvée : les arrosages restent à l'équipe) |
| Carrière, débutant | rang 3 à l'an 5 dans ≥ 70 % (cible du § 13.3 de CARRIERE.md) |
| Carrière, comice | gains du tranquille ≥ 90 % d'avant (épreuves à la main + stand) |
| Carrière Classique | faillites du tranquille ≤ 20 % (avant : 13 à 20 %) |

Leviers si une cible n'est pas tenue (dans cet ordre) : délai des jardiniers (4 → 3 ou 5 aubes), délai des machines
(2 → 3), prime à la main (1,25 → 1,2 ou 1,3), récompenses des fêtes, valeurs des trouvailles d'hiver, paliers des
lanternes. **Jamais** les chiffres des niveaux ni du mode Classique.

### 17.8.1 Résultats *(2026-10-03 ; niveaux : Détente, 200 parties par niveau et par stratégie, surprises et variété des deux côtés ; carrière : 60 carrières × 10 ans, saisons de 7 jours)*

**Niveaux** (`node tools/simulate.js --compare-cozy`) :

| # | tranquille : revenu (sans → avec) | argent final médian | débutant : revenu | appliqué : revenu |
|---|---|---|---|---|
| 1 | 2 048 → 2 091 (+ 2,1 %) | 555 → 593 | + 1,7 % | — |
| 2 | 2 127 → 2 218 (+ 4,3 %) | 305 → 378 | + 3,6 % | — |
| 3 | 2 170 → 2 264 (+ 4,3 %) | 345 → 376 | + 3,3 % | — |
| 4 | 1 738 → 1 833 (+ 5,5 %) | 533 → 619 | + 3,6 % | — |
| 5 | 3 037 → 3 180 (+ 4,7 %) | 485 → 583 | + 3,6 % | — |
| 6 | 2 274 → 2 363 (+ 3,9 %) | 344 → 368 | + 2,8 % | — |
| 7 | 2 599 → 2 692 (+ 3,6 %) | 217 → 253 | + 2,2 % | — |
| 8 | 2 327 → 2 422 (+ 4,1 %) | 382 → 460 | + 2,1 % | — |
| 9 | 1 704 → 1 766 (+ 3,6 %) | 293 → 344 | + 3,2 % | — |
| 10 | 2 284 → 2 357 (+ 3,2 %) | 674 → 736 | + 2,7 % | — |
| 11 | 2 044 → 2 114 (+ 3,4 %) | 392 → 452 | + 3,7 % | — |
| 12 | 2 449 → 2 517 (+ 2,8 %) | 404 → 467 | + 3,0 % | − 0,4 % |
| **moyenne** | **+ 3,8 %** (cible + 2 à + 5 % ✓) | **+ 14,8 %** | **+ 3,0 %** (≤ + 4 % ✓) | **+ 3,8 %** (≤ + 6 % ✓) |

Par partie (tranquille) : fêtes ≈ 30 pièces (≈ 2,1 fêtes jouées sur 4), hiver ≈ 18 pièces (niveau 5 : 40), une veillée,
≈ 2,4 écus de fêtes + 1 écu de veillée ; lanternes : total médian **12 / 20** (appliqué : 19 / 20 ; débutant : 7 / 20).
Victoires : inchangées ou meilleures à tous les niveaux (cibles du § 13.6 tenues). Seuils d'étoiles Détente
**recalculés** (§ 13.3 : ★★ et ★★★ relevés de 5 à 25 %). Les robots appliqués d'avant les humains (careless, balanced,
investor) ne jouent pas les fêtes : + 0,5 à + 0,9 % (trouvailles et Lili). Le mode Classique ne change pas (parité
400 / 400).

**Lanternes** (répartition 1 / 2 / 3 / 4 du tranquille) : niveaux — variété 12 / 50 / 23 / 15 %, soin 16 / 43 / 30 / 11 %,
voisinage 13 / 48 / 29 / 10 %, beauté 1 / 70 / 23 / 7 % (elle dépend du décor : 3 décorations dans la simulation),
prospérité 14 / 35 / 39 / 13 % ; carrière — variété 14 / 49 / 30 / 7 %, soin 15 / 45 / 28 / 11 %, voisinage 12 / 57 / 23 / 8 %,
beauté 15 / 33 / 37 / 15 %, prospérité 19 / 41 / 31 / 9 % ; total médian 12 / 20 (appliqué 17 / 20). Écus par année :
≈ 3 à 4 (fêtes et veillée) + les lanternes (niveaux : seulement les progrès ; carrière : ⌊(total − 5) ÷ 2⌋ ≈ 3).

**Carrière** (`node tools/simulate-career.js --compare-cozy`, `--compare-f1`) : voir le tableau du § 17.3.3. Par
carrière du tranquille : fêtes ≈ 1 100 pièces, hiver ≈ 500, stand du comice ≈ 300, 19 sachets de la foire, ≈ 29 écus de
fêtes et de veillées.

## 17.9 Ce que le lot prépare pour « La Vallée vivante » (sans l'implémenter)

- **Album** : la structure (pages, cases, tampons, indices, récompenses) est générique et en données ; la Vallée
  ajoutera ses pages **Graines anciennes** et **Faune** (identifiants de page réservés : `heirlooms`, `wildlife`) sans
  rien changer au moteur. Les oiseaux de la mangeoire, les traces dans la neige, la truite, le hérisson, le renard et le
  rouge-gorge sont les premiers habitants que la Vallée reprendra (ids d'espèces réservés, mêmes noms).
- **Graines anciennes** : le bocal de graines anciennes (lot 2, `state.career.heirlooms`) a sa case d'album ; la Vallée
  en fera les premières variétés.
- **Joseph** : ses 12 veillées racontent la vallée d'autrefois (haies, ruisseau, écrevisses, cigognes, la boîte en fer de
  sa mère) — le récit de départ de la Vallée.
- **Lanternes** : le critère « beauté » est fait pour accueillir plus tard les aménagements nature (haies, mares, bandes
  fleuries) ; les points sont en données.
- **F1** : le joueur revient aux champs ; la Vallée lui donnera ce que les machines ne font jamais (croiser des graines à
  la main, faire revenir la faune).
- Rien de la Vallée n'est dessiné ni simulé au lot 4 ; aucun état réservé n'est créé à l'avance.

## 17.10 Points ouverts

- Interrupteur « Fêtes et hiver » dans le choix du niveau pour les proposer aussi en Classique (désactivés par défaut) ?
- **Cuisine** (D4) : laissée au lot 5 ; la soupe partagée et les paniers en posent le principe (ingrédients = production
  de l'année, rien n'est consommé).
- Foire aux graines **dans les niveaux** (au 1er jour du printemps) : écartée pour l'instant (le niveau commence par les
  semis et le tutoriel ; la carte « Foire aux graines » du lot 3 joue déjà ce rôle).
- Le prototype F1 n'a mesuré ni le désherbage ni le comice « à la main » : à confirmer par la simulation complète
  (60 carrières).
- ~~Le débutant perd ≈ 20 % de patrimoine à l'an 10 avec F1~~ *(réglé à la livraison : + 7 %, voir § 17.3.3)*.
- **Ferme laissée seule** : la cible « au moins deux fois moins » n'est pas tenue avec les règles F1 (− 36 % sur la même
  ferme) : le reste vient des bêtes, du miel et des ateliers, ramassés par l'équipe (corvées). Pistes, si l'on veut aller
  plus loin (décision de l'utilisateur) : les soigneurs ramassent mais le fermier vend ; ou une humeur de l'équipe qui
  baisse sans visite du fermier.

---

# 18. La Vallée vivante (conception, 2026-10-03)

Le **grand projet long du mode Carrière**, choisi par l'utilisateur (« la Vallée qui revient » + « la Grainothèque
vivante », `docs/analyse/5-idees-projet-long.md` § 4 ; pas de copie de la restauration du village de Stardew).
Conception complète, chiffrée et découpée en lots : **`docs/VALLEE.md`** ; contrats du lot V1 : `docs/ARCHITECTURE.md`,
« Vallée vivante — contrats du lot V1 ». En bref :

- **Récit** : au rang 2, Joseph apporte la boîte en fer de sa mère (sa 1ʳᵉ veillée) : trois variétés anciennes et la
  première haie. Chaque étape de la vallée a son chapitre ; le 5ᵉ répond à « La vallée qui chante ».
- **Grainothèque vivante** : 12 variétés du pays (Carotte jaune du Doubs, Tomate Cœur de bœuf, Vitelotte…), chacune avec un
  **trait** (précoce, sobre, rustique, généreuse, savoureuse, mellifère, géante). On les retrouve dans des **bocaux**
  (défrichage, Basile, foire aux graines, le geai, et les bocaux déjà gardés depuis les lots 2 et 3), on les multiplie
  (chaque récolte **à la main** rend 2 graines) et on les **fixe** (6 récoltes à la main) : ensuite graines illimitées et
  équipe autorisée.
- **La vallée qui revient** : 8 aménagements nature sur des emplacements prédéfinis (haies, bandes fleuries, nichoirs,
  tas de bois, hôtels à insectes, nichoir à chouette, chêne isolé, berges de la mare) et la **jachère fleurie** ; 12
  habitants à recette d'habitat lisible (rouge-gorge, hérisson, coccinelles, bourdons, paon-du-jour, hirondelles, chouette
  hulotte, grenouille, libellules, lièvre, écureuil, geai) qui viennent puis **attendent que le joueur les touche** pour
  s'installer, et rendent un service doux (qualité, pousse, corbeaux, pêche, hiver…).
- **Étapes de la vallée** (0 à 5 au V1, 8 au V4), comptées en **signes de vie** (habitants + variétés fixées) : la lisière
  fleurit, les oiseaux reviennent, cueillette des haies, pollinisation, sol vivant, décor « Le tilleul de la vallée ».
- **Lots** : **V1** « La boîte en fer » (graines et premiers habitants, structurant) ; **V2** « Le troc et les croisements »
  (Grainothèque à 5 niveaux, troc avec les villageois, variétés croisées au nom de la ferme) ; **V3** « Le ruisseau »
  (vue de la vallée, 6 lieux à restaurer par chantiers et conditions de vie, terres sauvages après les 16 terrains : le
  grand puits d'argent) ; **V4** « Les cigognes » (légendes, visiteurs rarissimes, paysage et sons complets).
- **Règles d'or** : carrière seulement (parité des niveaux intacte ; seules deux pages d'album se voient dans la grange),
  rien ne se perd, aucune monnaie nouvelle, gestes réservés au joueur (« aider sans remplacer »), un seul indice à la
  fois, aucune peur de rater, flux aléatoire unique `valley`.
- **Équilibre** (cibles, `tools/simulate-career.js --compare-valley`) : V1 **+ 1 à + 5 %** de revenu pour le joueur
  tranquille (toute la Vallée ≤ + 8 %), rangs et Domaine à un an près, ferme laissée seule ≤ + 3 %, ≥ 1 nouveauté par
  saison ; ≈ 450 000 pièces de puits « pour la beauté » sur l'ensemble des lots (argent en caisse à l'an 14 divisé par 2
  au V3) ; dépenses comptées à 100 % au patrimoine (décidé : 100 %).

### 18.1 Lot V2 « Le troc et les croisements » (conception détaillée, 2026-10-03)

Conception complète : **`docs/VALLEE.md` § 16** ; contrats : `docs/ARCHITECTURE.md`, « Vallée vivante — contrats du lot
V2 ». En bref :

- **La Grainothèque** : un ouvrage de la Vallée sur un emplacement réservé de la bande de la maison (panneau au rang 3,
  récit « Une idée de Joseph »), **5 niveaux : 1 600 / 4 000 / 8 000 / 19 200 / 30 000** (rangs 3, 4, 5, 5, 6 ; **62 800**
  après réglage — départ 2 000 / 5 000 / 10 000 / 16 000 / 25 000 —, 100 % au patrimoine) : N1 troc de saison ; N2 3 graines par récolte à la main ; N3 variété sauvée en 5 récoltes ; N4
  croisement en 2 rencontres ; N5 graines des variétés sauvées au prix normal et touristes + 15 %. Sa fiche est la
  vitrine de la collection (35 bocaux, croisements, voisins).
- **Le troc** : chacun des **12 clients du tableau** garde une variété de son jardin (Carotte violette de Lili, Tomate
  noire de Crimée de Mme Chevalier, Pomme Api étoilé de Léon…). Une proposition à la fois, épinglée au tableau (pas une
  commande : aucune place, aucune récolte, aucune prime) : chaque **foire aux graines**, puis, avec la Grainothèque,
  **une par saison** (voisins ouverts par cercles avec les niveaux 1 à 3). On donne 3 graines d'une variété sauvée (gratuit),
  on reçoit 3 graines (4 si c'est une culture qu'il préfère). Elle attend sans limite.
- **Les croisements** : la variété du pays et celle du village d'une même culture, **semées côte à côte** (« Semer la
  paire », un geste) ; chaque récolte **à la main** de l'une pendant que l'autre pousse à côté = une **rencontre** ; **3
  rencontres** (déterministe, barre visible) → un sachet doré de 3 graines d'une **variété croisée** à deux traits, au nom de
  la ferme (« Tomate de la Ferme des Tilleuls ») ; **11** croisées (pas le pommier), à sauver comme les autres.
- **Trait Parfumée** (produit d'atelier + 15 %) ; **4 habitants** (osmie au printemps : rencontres doubles ; merle en
  hiver : 4 trouvailles des haies ; lézard en été : canicule + 10 % ; pipistrelle : équipe jamais lasse l'été) et le
  **nichoir à chauves-souris** ; 4 récits de Joseph ; **« Revoir la boîte en fer »** ; pages d'album `swaps`, `crosses`,
  `wildlife2` ; 6 succès ; stand de la fête + 1 point par culture à variété ancienne.
- **Aléatoire** : un flux nouveau `valley2` (4 nombres par aube, les habitants du V2) ; troc et croisements sans hasard ;
  aucun flux existant ne tire un nombre de plus. Niveaux et Classique strictement inchangés (parité).
- **Équilibre** (cibles `--compare-valley2`, V1 → V1 + V2) : tranquille **+ 0 à + 4 %** de revenu (estimé + 1 à + 1,5 %),
  rangs à un an près, argent en caisse à l'an 14 ≤ 70 % de sans la Vallée, **≥ 80 % des saisons avec une nouveauté** (le
  V1 seul : 65 %), ferme laissée seule ≤ + 3 %, `automator` sans troc ni croisement ; V2 complet vers l'an 11 à 13, toute
  la Vallée vers l'an 18 avec le V3.
- **À trancher** (`docs/VALLEE.md` § 16.15) : emplacement de la Grainothèque, croisements déterministes ou avec une part
  de chance, rythme du troc, signes de vie du V2 pour les étapes 1 à 5, liens écartés (comice, quête), nom des croisées.
