# Mode Carrière — conception (2026-09-30)

Document de référence du **mode Carrière** : sa ferme à soi, qui dure d'année en année et **grandit**. Les chiffres sont des **valeurs de départ** : ils seront réglés avec la simulation (`tools/simulate-career.js`, § 13) et la version qui fait foi vivra dans `src/data/career/`. Les chiffres marqués *(à régler)* sont les plus incertains.

Contrats de code (noms, formes, événements, propriété des fichiers) : `docs/ARCHITECTURE.md`, section « Mode Carrière — contrats ». Priorité au téléphone en portrait (`docs/MOBILE.md`) pour toute décision.

> **Règles d'or**
> 1. **Le mode Niveaux ne change pas** : les 12 niveaux, leurs chiffres, les deux modes de difficulté, le tutoriel, la parité (`tests/parity.test.js`) restent identiques. Toute règle de la carrière est gardée par `state.mode === 'career'` et ne tire **aucun** nombre aléatoire dans une partie de niveau.
> 2. **Détente d'abord** : pas de réflexes, pas de punition brutale, pas de fin de partie en Détente (§ 1.7). Rien ne se perd pour un oubli d'un jour.
> 3. **Tout au pouce, en portrait** : feuilles du bas, cibles ≥ 48 × 48 CSS px, parcelles ≥ 48 px à l'écran, rien seulement au survol.
> 4. **Le toucher reste un plaisir** : on délègue les corvées **progressivement** (employés, puis machines) ; à la fin, la ferme tourne presque seule (sensation « idle ») et le joueur **planifie** (terrains, plan de culture, équipe, fêtes, quêtes, décor).
> 5. **Le temps n'avance qu'en jeu** : aucune progression hors ligne (pas d'obligation de revenir).

---

## 0. Vue d'ensemble

| Système | En une phrase | § |
|---|---|---|
| Années continues | Les saisons s'enchaînent sans fin ; chaque hiver se termine par le **bilan de l'année**, puis l'année suivante commence avec la même ferme. | 1 |
| Charges de la ferme | Le fermage est remplacé par des **charges de saison** qui grandissent avec la ferme (20 + 15 par terrain acheté). | 1.4 |
| Rangs | 6 rangs, de **Petite ferme** à **Domaine** : patrimoine + 2 objectifs par rang ; chaque rang débloque du contenu. | 1.5 |
| Terrains | Le monde est une **colonne verticale** : on achète, un par un, les terrains de la forêt au-dessus de la ferme (12 au plus) et on les **aménage** (champ, pré, verger, mare, serre, cour des ateliers). | 2 |
| Bâtiments à niveaux | Maison (capacité d'employés), grenier → silo (stock, vente au bon moment), serre (cultures d'hiver), étal → marché fermier, abris d'animaux, ateliers jusqu'au niveau 5. | 4 |
| Animaux | 8 espèces : poule, canard, lapin, chèvre, vache, mouton, cochon (truffes), cheval (traction, balades). Leurs produits **se ramassent** (plafond de 3 jours, rien ne se perd). | 5 |
| Machines | Arroseurs, semoir, moissonneuse, cueilleuse, collecteur, tracteur, château d'eau, convoyeur. | 6 |
| Employés | Jardinier, soigneur, artisan, vendeur ; salaire par jour, niveaux 1 à 5, humeur simple, congés. | 7 |
| Événements vivants | 4 fêtes au calendrier, événements au hasard (visiteurs, touristes, corbeaux, arc-en-ciel…), **quêtes de Joseph** et son amitié (♥). | 8 |

Deux phases de réalisation (§ 14) : **Phase A — le socle** (années continues, terrains, champs, prés, verger, grenier, maison, employés, arroseurs/semoir/moissonneuse, poule/lapin/cochon/cheval, rangs, fêtes, quêtes, sauvegarde) et **Phase B — le contenu** (mare et canards, serre, tracteur niveau 2, château d'eau, convoyeur, conserverie, filature, marché fermier, embellissements, cerisier et poirier, animaux de compagnie).

---

## 1. Structure et boucle de jeu

### 1.1 Deux modes au menu principal

- **« Ma ferme »** (mode Carrière) — gros bouton en premier : « Continuer · Ferme des Tilleuls · Année 3, été · Belle ferme » quand une carrière existe, sinon « Commencer ma ferme ».
- **« Les niveaux »** (mode Niveaux) — l'actuel « Jouer » (choix du niveau, 12 années à contraintes). Son « Continuer » garde sa propre sauvegarde.
- Les deux sauvegardes coexistent (une carrière + une partie de niveau en cours). Ouvrir l'un enregistre l'autre.

### 1.2 Le temps

- **Inchangé** : 1 jour = 20 s à ×1, saisons de **7 jours**, année de 28 jours (≈ 9 min 30 à ×1, 10 à 15 min avec les fiches et fenêtres ouvertes). Vitesses pause, ×1, ×2, ×4.
- **Années continues** : `state.time.year` (1, 2, 3…) ; `state.time.day` repart à 1 chaque printemps. Au soir du dernier jour d'hiver : charges d'hiver, puis **bilan de l'année** (fenêtre, partie en pause), puis l'aube du 1er jour de printemps de l'année suivante.
- Ce qui continue d'une année à l'autre : **tout** (argent, terrains, parcelles et ce qui y pousse — navets et choux d'hiver continuent au printemps —, arbres, bâtiments, animaux, machines, employés, stock, amitié de Joseph). Ce qui repart à zéro : les statistiques de l'année (`stats.year`), le calendrier des fêtes.
- Le **gel** frappe chaque 1er jour d'hiver comme dans les niveaux (sauf dans la serre, § 4.3).

### 1.3 La boucle

| Échelle | Ce que fait le joueur |
|---|---|
| Quelques secondes | Semer, arroser, récolter (glisser), ramasser les œufs, chasser les corbeaux, pêcher (1 fois/jour). |
| Une journée / une saison | Choisir les cultures (plan de culture par terrain), acheter animaux et machines, embaucher, répondre aux visiteurs, remplir une quête de Joseph, préparer la fête de la saison. |
| Une année | Acheter un terrain et l'aménager, monter un bâtiment de niveau, viser le rang suivant, réussir le comice, préparer l'hiver (stock, serre, congés). |
| Plusieurs années | Passer de **Petite ferme** à **Domaine** (≈ 9 à 10 ans pour un joueur tranquille, 5 à 6 pour un joueur appliqué), puis jouer librement (fêtes, décor, records). |

Courbe de délégation voulue (joueur tranquille) : **année 1** tout à la main (~35 gestes par jour) ; **années 2-3** 1 à 2 employés et des arroseurs (~25 gestes) ; **années 5+** machines et équipe (~10 à 15 gestes par jour pour une ferme 5 fois plus grande) : on touche pour le plaisir (récolte à la main **+10 %**, § 3.3), pour les événements, et pour décider.

### 1.4 Charges de la ferme (remplacent le fermage)

| Charge | Quand | Détente | Classique |
|---|---|---|---|
| **Charges quotidiennes** | chaque aube | 2 (ferme) + entretien des animaux et bâtiments + **salaires** + **carburant** de la veille − panneaux solaires (qui ne réduisent jamais les salaires ; minimum : les salaires) | 5 (ferme) + idem |
| **Charges de saison** (« Impôts et assurance ») | soir du dernier jour de chaque saison | **20 + 15 × terrains achetés** | **40 + 25 × terrains achetés** |

- Exemple Détente : au départ 20 par saison ; avec 6 terrains, 110 par saison ; avec les 12, 200 par saison. Les charges suivent la taille de la ferme, pas le temps : une ferme qui ne grandit pas n'est jamais étranglée.
- La prévision de la barre du haut affiche les **charges de saison** comme elle affiche le fermage (montant, jours restants, vert / orange « Joseph aidera » / rouge).
- *Pas* d'hypothèque obligatoire ni de crédit pour la terre (gardé en idée : payer un terrain en 4 saisons, voir `JOURNAL.md`).

### 1.5 Rangs de la ferme (jalons)

Un rang s'obtient **dès que** le patrimoine atteint le seuil **et** que les deux objectifs du rang sont remplis (vérifié à chaque aube et après chaque achat). Pas de retour en arrière : un rang acquis l'est pour toujours (même si le patrimoine baisse).

**Patrimoine** = argent + prix payé pour les terrains + ½ × (aménagements, bâtiments et niveaux, machines, animaux achetés, au prix payé) − dette envers Joseph. Affiché dans le Carnet avec une barre vers le seuil suivant.

| Rang | Nom | Titre du fermier | Patrimoine *(à régler)* | Objectifs | Débloque |
|---|---|---|---|---|---|
| 1 | **Petite ferme** | Jeune fermier | départ | — | Carotte, navet, blé, chou, pomme de terre, fraise, tomate ; poules ; ruches (2) ; étal ; panneaux solaires ; **1 terrain** ; aménagements Champ et Pré ; bergerie, chèvrerie |
| 2 | **Ferme familiale** | Fermier | 1 200 | Acheter un premier terrain · Faire 60 récoltes *(100 → 80 → 60 après simulation, § 13.4)* | Maïs, tournesol, courgette, pommier ; **maison niv. 2** (2 employés) et **embauche** ; **grenier** ; étable (vaches) ; atelier de confitures ; aménagements Verger et Cour des ateliers ; **arroseurs** de terrain ; **jusqu'à 3 terrains** ; ruches (4) ; quêtes de Joseph |
| 3 | **Belle ferme** | Fermier reconnu | 4 000 | Embaucher un employé · Vendre 20 produits transformés *(30 avant la simulation)* | Citrouille ; maison niv. 3 (4 employés) ; porcherie (cochons), clapier (lapins), écurie (chevaux) ; fromagerie, moulin ; chambre d'hôte ; **semoir** et **moissonneuse** niv. 1, cueilleuse, collecteur ; serre *(phase B)* ; **jusqu'à 6 terrains** ; ruches (6) |
| 4 | **Grande ferme** | Maître fermier | 12 000 | 48 parcelles cultivables · Réussir 3 quêtes de Joseph | Maison niv. 4 (6 employés) ; **tracteur**, machines niv. 2 ; **silo** (grenier niv. 2) ; mare et canards, conserverie, filature *(phase B)* ; étal niv. 2 ; ateliers niv. 4 ; **jusqu'à 9 terrains** |
| 5 | **Exploitation modèle** | Grand exploitant | 30 000 | 5 employés · 6 espèces d'animaux | Maison niv. 5 **Manoir** (8 employés) ; grand silo ; ateliers niv. 5 ; château d'eau, convoyeur, marché fermier (étal niv. 3), embellissements *(phase B)* ; **jusqu'à 12 terrains** |
| 6 | **Domaine** | Seigneur du domaine | 100 000 *(70 000 avant la simulation, § 13.4)* | Maison au niveau Manoir · Réussir les 3 épreuves d'un comice | Panneau « Domaine des … », fanion doré sur la maison, objets de décor « Domaine » (écus), comice « régional » (prix doublés) ; jeu libre |

- Passage de rang : fenêtre « Votre ferme devient une **Belle ferme** ! » (fanfare de victoire, confettis) avec la liste des déblocages (icônes) et **+20 × rang écus** ; conseil « première fois » sur le premier déblocage utile.
- Le titre du fermier s'affiche dans le Carnet, sur l'écran de bilan et dans la grange (« Ma ferme »). Titre au féminin au choix (option « Fermière », § 15).
- Un contenu verrouillé reste **visible** et grisé avec « Rang 3 » (on sait ce qui vient).

### 1.6 Écus, succès, bonus, décor : ce qui est partagé

| Élément | En carrière | Raison |
|---|---|---|
| **Écus** (monnaie décorative) | **Partagés** (même porte-monnaie que les niveaux). Gagnés : bilan de fin d'année **10 + 3 × rang + min(20, ⌊bénéfice de l'année / 1 000⌋)** ; passage de rang 20 × rang ; quêtes de Joseph 3 ; succès de carrière. | Le décor est le même, gagné dans les deux modes. |
| **Décor, allées, clôture, tenue, nom** | **Partagés** : mêmes objets débloqués. Les emplacements de décor de la **bande de la maison** portent les mêmes identifiants (`porch.left`…) mais la carrière a **ses propres choix posés** (`career.cosmetics.decor`), initialisés depuis ceux de la progression au lancement. Nom de la ferme : propre à la carrière (proposé = celui de la grange). Emplacements de décor supplémentaires par terrain *(phase B)* : `lot<n>.corner`. | Décorer sa ferme de carrière sans défaire celle des niveaux. |
| **Succès** | **Partagés** (même liste, section « Carrière » dans la grange) : 17 succès de carrière (§ 1.6.1), **en écus seulement, sans étoile**. Les cumuls de récoltes et de produits de la carrière comptent pour « Cent paniers », « Grenier plein », « Herbier complet », « Artisan du terroir ». | Les étoiles restent la monnaie du mode Niveaux. |
| **Bonus permanents (étoiles)** | **Aucun effet** en carrière ; les étoiles ne s'y gagnent pas et ne s'y dépensent pas. | Ce sont des réglages d'équilibre des niveaux ; la carrière a sa propre progression (rangs). |
| **Conseils « première fois »** | Partagés (`hintsSeen`), nouveaux identifiants `career.*` (§ 10.8). | |

#### 1.6.1 Succès de carrière (récompense en écus)

| id | Nom | Condition | Écus |
|---|---|---|---|
| `careerStart` | Première pierre | Commencer une carrière | 5 |
| `firstLot` | Nouvelles terres | Acheter un terrain | 10 |
| `rank3` | Belle ferme | Atteindre le rang 3 | 20 |
| `rank6` | Le domaine | Atteindre le rang 6 | 100 |
| `firstHire` | Premier employé | Embaucher quelqu'un | 10 |
| `fullTeam` | Toute une équipe | 8 employés en même temps | 30 |
| `teamLeader` | Chef d'équipe | Un employé au niveau 5 | 20 |
| `firstMachine` | Mécanisation | Acheter une machine | 10 |
| `tractor` | Le tracteur | Acheter le tracteur | 20 |
| `winterTomato` | Tomates de Noël | Récolter une tomate en hiver (serre) | 20 |
| `menagerie` | L'arche | Les 8 espèces d'animaux en même temps | 30 |
| `truffles` | Nez fin | 10 truffes trouvées (cumul carrière) | 20 |
| `josephFriend` | Ami de Joseph | 10 cœurs d'amitié | 30 |
| `fairChampion` | Champion du comice | Réussir les 3 épreuves d'un comice | 20 |
| `tenYears` | Dix ans de bonheur | Commencer l'année 10 | 50 |
| `fullSilo` | Silo plein | Stock au maximum du grand silo | 15 |
| `recordYear` | Année record | 10 000 pièces de bénéfice en une année | 30 |

Total 440 écus. Icônes : `icon.ach.<id>` (agent graphique).

### 1.7 Difficulté et coups durs

La difficulté se choisit **à la création** de la carrière et ne change plus (affichée dans le menu pause et le Carnet). Défaut : **Détente**.

| Levier | Détente (défaut) | Classique |
|---|---|---|
| Charges quotidiennes de la ferme | 2 | 5 |
| Charges de saison | 20 + 15 × terrains | 40 + 25 × terrains |
| Prix des récoltes brutes | × 1,25 | × 1 |
| Pousse sans arrosage (canicule) | 0,75 (0,25) | 0,5 (0) |
| Argent de départ | 200 | 150 |
| Joseph | prête (règles ci-dessous) | ne prête pas |
| Charges impayables | **jamais de fin de partie** (coup dur, puis vente de secours) | **faillite** : la carrière se termine (archivée) |

**Soir des charges de saison, si l'argent manque** (dans cet ordre, chaque étape seulement si la précédente ne suffit pas) :

1. **Ateliers** : les produits en cours sont vendus en l'état (règle v3, raison `rent`).
2. **Grenier** : le stock est vendu au cours du jour, les cultures les moins chères d'abord, juste ce qu'il faut (événement `stockSold`, raison `charges`).
3. **Joseph** (Détente) : mêmes règles que `neighbour.js` (§ 13.5 du game design) avec un plafond de carrière **max(100, 100 % des charges de saison)** ; coussin 30 ; supplément 10 % (0 % à 6 ♥) ; la moitié des ventes le rembourse. **Pas d'effacement de dette en fin d'année** en carrière (la dette suit, sans intérêts supplémentaires).
4. **Coup dur** (Détente) : les charges sont payées quand même, l'argent devient **négatif** (découvert). Fenêtre douce « Une passe difficile » : les employés passent en **chômage technique** (pas de salaire, pas de travail) et les machines à carburant s'arrêtent tant que l'argent est négatif ; ils reprennent tout seuls quand l'argent repasse au-dessus de 50. Achats impossibles (sauf graines).
5. **Vente de secours** (Détente) : si, au soir des charges **suivantes**, l'argent est encore sous **− (charges de saison)** après les étapes 1 à 3, la coopérative rachète, du plus récent au plus ancien, **animaux, puis machines** à **50 %** de leur prix jusqu'à revenir à 0. Jamais les terrains, les bâtiments, les arbres ni les employés. On continue à jouer. (La simulation vérifie qu'un joueur tranquille ne la voit pratiquement jamais, § 13.)
6. **Classique** : à l'étape 3, faillite. Fenêtre « La ferme est vendue » (bilan de carrière), la carrière est **archivée** (`progress.career.archive` : nom, années, rang, meilleur patrimoine) et « Commencer une nouvelle ferme » est proposé.

Garde-fou anti-spirale : les salaires et le carburant ne sont **jamais** prélevés quand l'argent est négatif (chômage technique). Seuls l'entretien des animaux et la charge de la ferme continuent (petits montants).

### 1.8 Sauvegarde

- **Une seule carrière** à la fois, clé `une-annee-a-la-ferme.career` : `{ schema: 1, savedAt, meta: { farmName, year, seasonId, day, rank, difficulty, patrimony }, state }` (`state` = `game.serialize()`, `state.mode === 'career'`). `meta` sert au bouton « Continuer » du menu sans charger la partie.
- **Copie de secours** : `une-annee-a-la-ferme.career.bak`, réécrite au plus une fois par aube avec la dernière sauvegarde **qui a été relue avec succès**. Si la sauvegarde principale est illisible, on propose « Reprendre la sauvegarde de secours (hier) ».
- Enregistrement : à chaque aube, à la fermeture / mise en arrière-plan, après chaque achat de terrain, bâtiment ou machine, et au bilan de l'année.
- **Versions** : `state.career.version` (1). `migrateCareer(saved)` fait passer chaque version à la suivante (champs ajoutés à leur valeur par défaut) ; une version inconnue (plus récente) est refusée sans être effacée (message « Cette sauvegarde vient d'une version plus récente du jeu »).
- « Recommencer une ferme » (menu pause → Recommencer, ou menu principal → Ma ferme → ⋯) : double confirmation, la carrière est **archivée** puis effacée. « Effacer la progression » (options) efface aussi la carrière (texte de confirmation explicite).
- La progression (`une-annee-a-la-ferme.progress`) gagne `career: { started, bestRank, bestYear, years, archive: [{ farmName, years, rank, patrimony, endedBy: 'bankrupt'|'restart' }] }` (5 dernières).

---

## 2. Les terrains : une ferme qui s'étend

### 2.1 Le monde en portrait

Le monde reste une **colonne de 14 tuiles** de large (12 utiles, forêt sur les bords), comme dans les niveaux : même zoom, parcelles de 2 × 2 tuiles (≈ 61 CSS px sur le Pixel 7, ≥ 53 px sur 360 × 740). La ferme **grandit vers le haut** : la maison et la route restent en bas (près du pouce), chaque terrain acheté **repousse la forêt** d'une bande de 11 tuiles.

```
 y (tuiles, de haut en bas)
 ┌──────────────────────────────┐
 │ forêt (2 lignes)             │
 │ TERRAIN À VENDRE n+1         │ ← forêt assombrie, panneau « À vendre · 900 »
 │ (11 lignes)                  │
 ├──────────────────────────────┤
 │ Terrain n (le plus récent)   │   chaque terrain : 12 × 11 tuiles utiles
 │ …                            │
 │ Terrain 1                    │
 ├──────────────────────────────┤
 │ La basse-cour (départ)       │   poulailler │ emplacement libre
 ├──────────────────────────────┤
 │ Le champ de départ (4 × 4)   │   12 parcelles ouvertes + 4 à acheter
 ├──────────────────────────────┤
 │ La maison (maison, puits,    │   grenier / silo à droite
 │ grenier) + perron            │
 │ route (2 lignes), étal       │
 │ forêt (2 lignes)             │
 └──────────────────────────────┘
```

- Hauteur du monde : 2 (forêt) + 11 (terrain à vendre) + 11 × terrains achetés + 11 (basse-cour) + 12 (champ de départ) + 12 (maison, route, étal, forêt) ≈ **48 tuiles au départ, 180 au maximum** (≈ 1,9 à 7 écrans de haut au Pixel 7). Le tampon de la scène (px du monde à l'échelle 1) reste petit (224 × 2 900 px au plus).
- Au démarrage et après chaque fermeture de feuille, la vue revient sur **le dernier endroit regardé** (mémorisé dans l'interface ; au premier lancement : le champ de départ).
- **Aller vite ailleurs** : toucher l'onglet « Ferme » quand on est déjà sur la ferme ouvre la **Carte** (§ 10.4) ; chaque terrain y a un bouton « Aller » (défilement animé). Sur ordinateur : molette, et touches Page haut / Page bas.
- Ordinateur (grand écran paysage) : le même monde en colonne, centré, avec zoom par la hauteur (≈ 24 tuiles visibles) ; forêt décorative sur les côtés ; feuilles à droite. **Pas de disposition paysage séparée** pour la carrière.

### 2.2 Acheter un terrain

- Les terrains s'achètent **dans l'ordre** (toujours celui juste au-dessus du dernier) : la colonne reste continue. Le nombre de terrains possédés est limité par le rang (§ 1.5 : 1, 3, 6, 9, 12).
- Prix *(à régler)* : **250, 400, 600, 900, 1 300, 1 900, 2 700, 3 800, 5 300, 7 400, 10 000, 14 000** (total 48 550). Chaque terrain ajoute **+15 aux charges de saison** (Détente ; +25 en Classique).
- Achat : toucher le panneau « À vendre » de la scène, ou la Carte → « Acheter ». Feuille : nom du terrain (« Le Haut-Champ », noms fixes par rang de terrain : « Le Pré du ruisseau », « La Combe », « Les Terres Joseph »…, liste en données), prix, « +15 de charges par saison », puis le choix de l'**aménagement** (§ 2.3) ; on peut laisser le terrain en **friche** et l'aménager plus tard.
- Animation : les arbres de la bande tombent/s'effacent (poussière, feuilles), la friche apparaît (herbe haute, souches), puis l'aménagement se construit (clôture posée de gauche à droite, 1 s). Son : scie + cloche.
- **Réaménager** : possible si le terrain est vide (aucune culture, aucun bâtiment, aucun animal) ; on paie le nouvel aménagement, pas le terrain.

### 2.3 Les aménagements (types de terrain)

| Type | id | Prix de l'aménagement | Rang | Contenu | Maximum |
|---|---|---|---|---|---|
| Friche | `wild` | 0 | 1 | Herbe, souches, fleurs sauvages. Rien. | — |
| **Champ** | `field` | 150 | 1 | 4 × 4 = **16 parcelles** labourées et ouvertes, clôture, rangée d'arroseurs, 2 ruches possibles sur le côté, aire des machines (bas du terrain). | 6 champs (départ compris) |
| **Pré** | `meadow` | 120 | 1 | Clôture, abreuvoir ; **2 emplacements** (gauche, droite) pour un abri d'animaux ou la chambre d'hôte (§ 4.6). | 4 |
| **Verger** | `orchard` | 100 | 2 | 3 × 3 = **9 emplacements d'arbres** (parcelles de 2 × 2 tuiles espacées d'une tuile, herbe), pommier (cerisier et poirier en phase B). | 2 |
| **Cour des ateliers** | `workshops` | 100 | 2 | Pavés, **2 emplacements** d'atelier. | 3 |
| **Mare** *(phase B)* | `pond` | 400 | 4 | Mare (8 × 5), ponton de pêche, canards (§ 5). | 1 |
| **Serre** *(phase B)* | `greenhouse` | 800 (= serre niveau 1) | 3 | Serre vitrée 10 × 7 avec 4 puis 8 parcelles (§ 4.3). | 1 |

Chaque terrain porte un **panneau** (coin bas gauche, 1 tuile) : le toucher ouvre la **fiche du terrain** (§ 10.5). Parcelles d'un champ : toutes ouvertes à l'aménagement (pas d'achat parcelle par parcelle, sauf dans le champ de départ : 4 parcelles à 40 + 10 × déjà achetées, comme les niveaux).

### 2.4 Gabarits (pour le rendu)

Tous les terrains font **12 × 11 tuiles utiles** (x 1 à 12), bande de forêt en x 0 et x 13. Gabarits indicatifs (le lot RENDER fixe le détail) :

- **Champ** : clôture 10 × 10 (x 2-11), parcelles 8 × 8 (x 3-10, lignes 1-8), marge haute (arroseurs) ; colonne x 1 : 2 ruches ; ligne 10 : chemin, panneau du terrain (x 1), aire des machines (x 8-11 : semoir, moissonneuse garés, tracteur quand il y travaille).
- **Pré** : deux demi-terrains de 6 × 11 ; chacun : abri 3 × 3 en haut, enclos 5 × 6 dessous, animaux qui s'y promènent ; ligne 10 : chemin, abreuvoir, panneau.
- **Verger** : 3 × 3 arbres (x 2-3, 5-6, 8-9 ; lignes 1-2, 4-5, 7-8), herbe fleurie au printemps, cueilleuse garée en bas.
- **Cour des ateliers** : deux ateliers 3 × 3 ou 3 × 4 (x 2-4, x 8-10) sur pavés, tapis du convoyeur (phase B) sur la ligne 9.
- **Mare** : eau 8 × 5 au centre (bords en autotuile), ponton 3 × 1, canards sur l'eau, nénuphars, roseaux.
- **Serre** : structure vitrée 10 × 7 (x 2-11), 2 rangées de 4 parcelles à l'intérieur, cheminée au niveau 3.
- **Basse-cour** (départ) : poulailler (cabane 2 × 3 + cour 5 × 5) à gauche, emplacement libre à droite.
- **Maison** (départ) : maison x 1-4 (taille selon niveau, § 4.1), puits x 5, grenier/silo x 9-12, perron, route, étal (x 8-11 sous la route).

### 2.5 Limites (performances et lisibilité)

| Élément | Maximum |
|---|---|
| Terrains achetés | 12 (+ maison, champ de départ, basse-cour) |
| Parcelles (champs + serre + verger) | **128** (6 × 16 + 8 + 2 × 9 = 122) |
| Animaux (toutes espèces) | 80 ; la scène en dessine **6 au plus par abri** (les autres sont « dans l'abri ») |
| Employés | 8 |
| Machines | une par type et par terrain ; 1 tracteur, 1 château d'eau, 1 convoyeur |

---

## 3. Cultures, marché et plan de culture

### 3.1 Cultures

Toutes les cultures des niveaux (`CROPS`), débloquées par rang (§ 1.5). Mêmes règles de pousse, d'arrosage, de gel et d'arbres. Les **arbres restent d'une année à l'autre** (le pommier planté l'an dernier donne dès l'été). *(Phase B)* Deux nouveaux arbres réservés à la carrière :

| Arbre | id | Plant | Adulte | Fruits (saisons) | Panier | Transformation |
|---|---|---|---|---|---|---|
| Cerisier | `cherry` | 60 | 7 j | printemps, été · 3 j | 30 | Confiture de cerises 52, 2 j (atelier de confitures) |
| Poirier | `pear` | 50 | 6 j | automne · 2 j | 28 | Jus de poire 46, 1 j (atelier de confitures) |

### 3.2 Le cours du marché (carrière)

- Chaque aube, chaque culture a un **cours** entre **× 0,8 et × 1,3** (flux `market`, retour vers 1 : `meanReversion 0,5`, pas ± 0,1). Affiché dans la feuille des graines, la fiche d'une parcelle mûre et le grenier (flèches ▲▼, couleur).
- **Hors saison** : une culture vendue dans une saison où elle **ne peut pas être semée** (hors serre) vaut **× 1,25** (blé ou maïs gardés au grenier et vendus en hiver, tomates de serre en hiver).
- Jours de fête : bonus du § 8.1.
- Prix de vente d'une récolte = prix de base × mode (1,25 Détente) × cours × hors saison × (1 + étal + vendeur) × rendement (fatigue du sol, nuisibles) × **1,10 si récoltée à la main** (§ 3.3), arrondi.

### 3.3 La récolte à la main

En carrière, une récolte **touchée par le joueur** vaut **+10 %** (« Cueilli main », petit cœur vert dans le texte flottant). Récoltes des employés et des machines : prix normal. Le glisser pour récolter compte comme « à la main ». C'est la raison de continuer à toucher quand tout est automatisé.

### 3.4 Plan de culture (par terrain)

Chaque champ (et la serre) a un **plan** : pour chaque saison, `'same'` (replanter la dernière culture récoltée sur la parcelle si on peut la semer ; défaut), un identifiant de culture, ou `null` (ne rien semer). Le semoir et les jardiniers suivent le plan ; le joueur, lui, sème ce qu'il veut. Réglage dans la fiche du terrain : 4 lignes (une par saison, ≥ 56 px) → feuille des graines de la saison. Sécurité : jamais de semis qui gèlera avant maturité (la culture est sautée ce jour-là, remplacée par la plus rentable de la saison qui résiste, ou rien) ; jamais de semis si l'argent ne couvre pas la graine.

---

## 4. Bâtiments à niveaux

Tous les bâtiments ont un identifiant **unique** dans la ferme (un seul de chaque type) et un **niveau**. Améliorer : toucher le bâtiment → sa fiche → « Améliorer (prix) ». Le niveau se voit dans la scène (sprite ou annexe, § 11).

### 4.1 Maison (`house`) — capacité d'employés

| Niv. | Nom | Prix | Rang | Employés au plus | En plus |
|---|---|---|---|---|---|
| 1 | Maisonnette | départ | 1 | 0 | — |
| 2 | Maison | 500 | 2 | 2 | Bureau d'embauche |
| 3 | Grande maison | 1 500 | 3 | 4 | Cuisine : humeur des employés « Las » après 28 jours au lieu de 21 |
| 4 | Corps de ferme | 4 000 | 4 | 6 | — |
| 5 | Manoir | 10 000 | 5 | 8 | Objectif du rang 6 ; +10 écus par bilan annuel |

### 4.2 Grenier / silo (`storage`) — garder pour vendre au bon moment

| Niv. | Nom | Prix | Rang | Capacité (unités) |
|---|---|---|---|---|
| 1 | Grenier | 400 | 2 | 30 |
| 2 | Silo | 1 500 | 4 | 100 |
| 3 | Grand silo | 4 000 | 5 | 250 |

- **Une unité** = une récolte (ou un panier de fruits). Pas les produits transformés (vendus seuls à l'aube, règle v3) ni les produits animaux.
- **Mise en réserve** (réglage de la fiche, 3 choix segmentés ≥ 48 px) : « Jamais » · « Quand le cours est bas » (défaut : cours du jour < 1,0 et pas hors saison) · « Toujours ». Une récolte mise en réserve ne rapporte rien tout de suite (texte flottant : icône → grenier). Grenier plein : vendue normalement (jamais de perte, jamais de file).
- **Vendre** : fiche du grenier = une ligne par culture (icône, quantité, cours du jour, prix unitaire, total), bouton « Vendre » par ligne et « Tout vendre » en bas. La vente se fait au prix du jour (§ 3.2, sans le bonus « à la main »).
- **Rien ne se gâte**. Filet de sécurité aux charges de saison (§ 1.7, étape 2).
- Vendeur (§ 7) : vend tout seul au bon moment. Convoyeur (§ 6) : les ateliers puisent dans le grenier.

### 4.3 Serre (`greenhouse`, phase B) — cultures d'hiver

| Niv. | Nom | Prix | Parcelles | Effet |
|---|---|---|---|---|
| 1 | Serre froide | 800 (aménagement) | 4 | Pas de gel, pas de pluie (il faut arroser), météo sans effet ; **toutes les cultures en toute saison** (pas d'arbres) ; en hiver, pousse × 0,5 |
| 2 | Grande serre | 1 200 | 8 | idem |
| 3 | Serre chauffée | 3 000 | 8 | Pousse × 1,1 toute l'année, hiver compris ; chauffage **3 par jour d'hiver** |

Avec le cours « hors saison » × 1,25, une tomate de serre vendue en hiver rapporte ≈ 59 (Détente) : la serre est **le** revenu d'hiver des fermes avancées.

### 4.4 Étal (`roadsideStand`) — la vente

| Niv. | Nom | Prix | Rang | Bonus de prix | Revenu des passants |
|---|---|---|---|---|---|
| 1 | Étal au bord de la route | 180 | 1 | +20 % | 4 / 8 / 4 / 2 par jour (printemps → hiver), rien les jours d'orage |
| 2 | Boutique de la ferme | 600 | 4 | +30 % | × 2 |
| 3 | Marché fermier *(phase B)* | 1 800 | 5 | +40 % | × 3 ; visiteurs acheteurs 1,5 fois plus fréquents |

Le bonus de prix s'applique aux récoltes, aux fruits, aux produits transformés et au stock vendu.

### 4.5 Abris d'animaux (capacité)

Un abri se construit sur un **emplacement** de pré (ou de la basse-cour) ; son niveau fixe le nombre d'animaux.

| Abri | id | Animaux | Construction (niv. 1) | Niv. 2 | Niv. 3 | Capacité 1 / 2 / 3 | Rang |
|---|---|---|---|---|---|---|---|
| Poulailler | `coop` | poules | offert (basse-cour) | 150 | 400 | 4 / 8 / 12 | 1 |
| Bergerie | `sheepfold` | moutons | 200 | 350 | 700 | 3 / 5 / 8 | 1 |
| Chèvrerie | `goatShed` | chèvres | 150 | 300 | 600 | 3 / 5 / 8 | 1 |
| Étable | `cowshed` | vaches | 250 | 400 | 800 | 3 / 5 / 8 | 2 |
| Porcherie | `pigsty` | cochons | 250 | 400 | 800 | 2 / 4 / 6 | 3 |
| Clapier | `hutch` | lapins | 120 | 250 | 500 | 4 / 8 / 12 | 3 |
| Écurie | `stable` | chevaux | 400 | 600 | 1 200 | 1 / 2 / 4 | 3 |
| Mare *(phase B)* | `duckPond` | canards | aménagement de la mare | 200 | 500 | 4 / 8 / 12 | 4 |

### 4.6 Chambre d'hôte (`guestHouse`) — sur un emplacement de pré

| Niv. | Prix | Revenu (printemps / été / automne / hiver) | Entretien |
|---|---|---|---|
| 1 | 300 | 20 / 34 / 20 / 8 | 2 |
| 2 | 800 | × 1,5 | 3 |
| 3 | 2 000 | × 2,2 | 4 |

Rang 3. Avec des chevaux : balades (§ 5).

### 4.7 Ateliers (niveaux 1 à 5)

Mêmes règles que la v3 (interrupteur, places, vente seule à l'aube, vendre en l'état) ; en carrière, **5 niveaux** (places **2 / 3 / 4 / 5 / 6**) ; on les construit sur un emplacement de **cour des ateliers**.

| Atelier | id | Prix niv. 1 → 5 | Entretien | Rang | Recettes |
|---|---|---|---|---|---|
| Atelier de confitures | `jamWorkshop` | 90 / 120 / 160 / 320 / 640 | 1 | 2 | v3 + (phase B) cerise → confiture de cerises 52, 2 j ; poire → jus de poire 46, 1 j |
| Fromagerie | `dairy` | 160 / 130 / 170 / 340 / 680 | 2 | 3 | v3 (lait de vache, de chèvre) |
| Moulin | `mill` | 150 / 130 / 200 / 400 / 800 | 1 | 3 | v3 (farine, puis pain dès le niv. 3) |
| Conserverie *(phase B)* | `cannery` | 300 / 250 / 350 / 700 / 1 400 | 2 | 4 | Tomate (38) → **Sauce tomate 66**, 2 j · Citrouille (62) → **Soupe de citrouille 105**, 3 j · Courgette (22) → **Ratatouille 40**, 2 j |
| Filature *(phase B)* | `spinningMill` | 250 / 200 / 300 / 600 / 1 200 | 1 | 4 | Tonte d'un mouton (90) → **Écheveaux de laine 150**, 3 j (la tonte entre à la filature au lieu d'être payée, une place par mouton) |

Ateliers niv. 4-5 : « Artisan » de la v3 n'existe pas ici ; c'est l'employé **artisan** (§ 7) qui ajoute des places.

### 4.8 Aménagements de la ferme (sans niveau)

- **Ruches** (`beehive`) : 60 / 80 / 100 / 120 / 140 / 160 ; +5 par jour hors hiver ; **+5 %** de pousse chacune (toute la ferme, hors hiver) ; 2 au plus par champ (côté gauche) ; 2 / 4 / 6 au plus selon le rang.
- **Panneaux solaires** (`solarPanel`) : 80 / 100 / 150 / 200 (4 au plus) ; −5 de charges quotidiennes chacun (jamais sur les salaires ni le carburant). Posés près de la maison puis sur le toit du grenier.
- **Embellissements** *(phase B)* — puits d'argent de fin de partie, **achetés en pièces**, avec un effet **tourisme** (pas les décorations en écus, qui restent sans effet) : fontaine (2 000), kiosque à musique (3 500), statue du fondateur (6 000), jardin à la française (9 000). Chacun ajoute **+1 attrait** ; revenu des touristes (§ 8.2) × (1 + 0,15 × attrait). Emplacements dédiés dans la bande de la maison et dans les prés.

---

## 5. Animaux

En carrière, chaque animal est une **unité** (une poule, une vache…), dans son abri. Le prix monte un peu avec le nombre possédé (`prix = base + pas × déjà possédés`).

| Animal | id | Abri | Prix (base + pas) | Produit | Valeur / jour | Entretien / jour | Rang | Particularité |
|---|---|---|---|---|---|---|---|---|
| Poule | `hen` | poulailler | 30 + 0 | œufs | 2 | 0 | 1 | 2 poules offertes au départ (cadeau de Joseph) |
| Lapin | `rabbit` | clapier | 40 + 0 | laine angora | 2 | 0 | 3 | **Naissances** : à chaque début de saison, +1 lapin par couple (⌊n / 2⌋), dans la limite du clapier (gratuit, message « 2 lapereaux sont nés ! ») |
| Canard *(phase B)* | `duck` | mare | 45 + 0 | œufs de cane | 3 | 0 | 4 | Nagent sur la mare |
| Chèvre | `goat` | chèvrerie | 80 + 5 | lait | 9 | 1 | 1 | Lait → fromagerie (v3) |
| Vache | `cow` | étable | 150 + 10 | lait | 16 | 3 | 2 | Lait → fromagerie (v3) |
| Mouton | `sheep` | bergerie | 110 + 10 | tonte | 90 par tonte (3 par an) | 2 | 1 | Tonte automatique (règle des niveaux) ; → filature (phase B) |
| Cochon | `pig` | porcherie | 140 + 10 | **truffes** | — | 2 | 3 | Chaque aube d'**automne et d'hiver**, chaque cochon a **30 %** de chance de trouver une truffe (**60**) : revenu d'hiver (≈ 250 par cochon et par an) |
| Cheval | `horse` | écurie | 400 + 100 | — | — | 3 | 3 | **Traction** : permet le semoir et la moissonneuse **niv. 1** sans tracteur ; **balades** : +8 par jour et par cheval (printemps → automne) si la chambre d'hôte existe |

### 5.1 Ramasser (la corvée des animaux)

- La production quotidienne (œufs, lait non transformé, laine angora, truffes) **s'accumule dans l'abri** au lieu d'être payée à l'aube : bulle au-dessus de l'abri (icône du produit + valeur, « 🥚 18 »).
- **Toucher l'abri** (ou son enclos) = **ramasser** : l'argent est gagné tout de suite (+ pièces, cri de l'animal). Le lait qui part à la fromagerie, la tonte et les naissances restent automatiques.
- **Plafond : 3 jours** de production par abri. Au-delà, l'abri est « plein » (la bulle clignote doucement) et la production du jour est **perdue** — un oubli de 1 à 2 jours ne coûte rien. *(À régler : si la simulation montre que le joueur tranquille perd plus de 5 % de ses revenus animaux, passer à 4 jours.)*
- Automatisation : **soigneur** (§ 7) ou **collecteur** de l'abri (§ 6).
- Revenu « soigné » : +5 % par niveau du soigneur assigné.

---

## 6. Automatisation (machines)

Les machines se posent **sur un terrain** (sauf les machines de ferme). Elles travaillent seules à heure fixe, **se voient** (arroseurs qui tournent, moissonneuse qui passe rang par rang) et coûtent un **carburant** payé avec les charges du lendemain, seulement les jours où elles ont travaillé.

| Machine | id | Où | Niv. 1 | Niv. 2 | Carburant / entretien | Rang | Quand elle travaille |
|---|---|---|---|---|---|---|---|
| **Arroseurs** | `sprinklers` | champ, serre | 150 : 8 parcelles | +250 : tout le terrain | entretien 1 / jour | 2 | aube (étape de l'arrosage automatique) |
| **Semoir** | `seeder` | champ, serre | 500 : 8 semis par jour (**cheval ou tracteur**) | +700 : tout le terrain (**tracteur**) | 2 par jour de travail | 3 (niv. 2 : 4) | aube, puis 35 % du jour (après la moissonneuse) |
| **Moissonneuse** | `harvester` | champ | 700 : 8 récoltes par jour (**cheval ou tracteur**) | +1 000 : tout le terrain (**tracteur**) | 3 par jour de travail | 3 (niv. 2 : 4) | 30 % du jour |
| **Cueilleuse** | `fruitPicker` | verger | 400 : toutes les pommes (fruits) mûres | — | 1 par jour de travail | 3 | 30 % du jour |
| **Collecteur** | `collector` | un abri | 250 : ramasse l'abri 2 fois par jour | — | 0 | 3 | 40 % et 80 % du jour |
| **Tracteur** | `tractor` | ferme | 2 000 : machines niv. 2 ; jardiniers +25 % d'actions | — | 4 par jour où il sert | 4 | — |
| **Château d'eau** *(B)* | `waterTower` | ferme | 3 000 : arroseurs sans entretien, serre arrosée chaque aube, canicule sans effet sur les terrains aux arroseurs niv. 2 | — | 0 | 5 | aube |
| **Convoyeur** *(B)* | `conveyor` | ferme | 2 500 : quand une place d'atelier se libère, elle se remplit avec le stock du grenier (culture transformable la plus chère d'abord) | — | 1 / jour | 5 | aube (après les ateliers) |

Règles :

- **Interrupteur** par machine (fiche du terrain) : éteinte, elle ne travaille pas et ne coûte rien (l'entretien des arroseurs reste). Chômage technique (§ 1.7) : les machines à carburant s'arrêtent seules.
- La moissonneuse récolte au prix normal (pas de « à la main »), respecte les ateliers et le grenier (interrupteurs), ne touche jamais aux arbres.
- Le semoir suit le **plan de culture** (§ 3.4), achète les graines (prix du jour) et s'arrête s'il n'y a plus d'argent.
- Cheval **ou** tracteur pour le niveau 1 : un seul cheval suffit pour toutes les machines niv. 1 de la ferme.
- Les machines passent **avant** les employés sur leur terrain ; un employé ne refait jamais ce qu'une machine vient de faire.
- Ce qui reste au joueur quand tout est automatisé : récolte à la main (+10 %), événements (corbeaux, visiteurs, fêtes, quêtes), planification, achats, décor, pêche.

---

## 7. Employés

### 7.1 Embaucher

- Débloqué au **rang 2** avec la **maison niv. 2** ; nombre au plus = capacité de la maison (§ 4.1), jamais plus de 8.
- **3 candidats** proposés, renouvelés à chaque début de saison (flux aléatoire `staff`). Chaque candidat : prénom (liste de 24 prénoms français : Lucie, Marcel, Rose, Paulin, Jeanne, Léon, Margot, Émile, Suzanne, Gaston, Louise, Aimé, Colette, Firmin, Odette, Victor, Berthe, Armand, Irène, Lucien, Yvette, Hector, Mireille, Jules), **apparence** (4 tenues × chapeau oui/non × 4 teintes de cheveux et de peau = 32), **un trait**, **niveau 1 ou 2** (niv. 2 : 1 candidat sur 3 à partir du rang 4), métier de prédilection (affiché, sans effet : suggestion).
- Embaucher : gratuit ; le salaire commence à l'aube suivante. Renvoyer : gratuit (fenêtre « Au revoir, Lucie ! Merci pour tout. »), sans pénalité.

### 7.2 Métiers et affectations

| Métier | id | Affecté à | Travail | Gain d'expérience |
|---|---|---|---|---|
| **Jardinier** | `gardener` | un champ, le verger, la serre, ou « tous les champs » (−20 % d'actions : trajets) | Par ordre de priorité : chasser les corbeaux, **récolter**, **arroser**, **semer** selon le plan (achète les graines) ; au verger : récolter les fruits | 1 par action |
| **Soigneur** | `keeper` | un pré, la basse-cour, la mare, ou « tous les animaux » | **Ramasse** les abris 3 fois par jour (25 %, 55 %, 85 % du jour) ; revenus des animaux de ses terrains **+5 % par niveau** | 2 par abri ramassé |
| **Artisan** | `artisan` | une cour des ateliers | Ateliers de cette cour : **+1 place** (niv. 1-2), **+2 places** (niv. 3-4), +2 places et produits **+10 %** (niv. 5) | 2 par produit vendu |
| **Vendeur** | `seller` | la ferme (un seul vendeur compte) | Vend le stock du grenier quand le cours ≥ **1,15** (−0,02 par niveau) ou hors saison ; toutes les ventes **+2 % par niveau** ; jours de fête : vend tout le stock à la fête | 1 par 10 pièces vendues |

- **Actions par jour** du jardinier : **14 / 18 / 22 / 26 / 30** (niv. 1 → 5) ; × 1,25 avec le tracteur ; humeur ± 10 % ; trait « Costaud » + 20 %. Repère : un champ de 16 parcelles sans arroseurs demande ≈ 20 actions par jour ; avec arroseurs, ≈ 8.
- Les employés travaillent **de 15 % à 85 % du jour** : chaque action a une heure de fin calculée (durée = 70 % du jour ÷ actions par jour) ; entre-temps, le personnage marche vers sa cible (§ 12). Si le joueur a déjà fait l'action, l'employé passe à la suivante (pas d'expérience).
- Un employé **sans affectation** se repose à la maison (salaire payé).

### 7.3 Salaire, niveaux, humeur, congés

- **Salaire par jour** : **8 + 3 × (niveau − 1)** (8, 11, 14, 17, 20), payé avec les charges de l'aube. Trait « Économe » : −2.
- **Niveaux** : expérience 0 → **100** (niv. 2) → **300** → **700** → **1 500** (niv. 5). Passage : message « Lucie passe jardinière niveau 3 (+4 actions par jour, salaire 14) » ; le salaire suit.
- **Humeur** (3 états, jamais de départ) : **Joyeux** (+10 %) pendant 7 jours après une **fête** (§ 8.1) ou un **congé** d'au moins 2 jours ; **Las** (−10 %) après **21 jours** de travail d'affilée sans congé ni fête (28 avec la maison niv. 3) ; sinon **Content**. Trait « Fidèle » : jamais las.
- **Congé** : interrupteur par employé (ni travail, ni salaire). Bouton « Toute l'équipe en congé » (pratique en hiver, quand les champs sont vides). **Chômage technique** automatique quand l'argent est négatif (§ 1.7).
- **Traits** (7, tous positifs) : Costaud (+20 % d'actions) · Économe (salaire −2) · Vif (expérience × 1,5) · Fidèle (jamais las) · Ami des bêtes (soigneur : +5 % de plus) · Bavard (vendeur : +3 % de plus) · Matinal (commence à 5 % du jour : +15 % d'actions).

---

## 8. Événements vivants

### 8.1 Le calendrier (chaque année, fixe)

| Quand | Événement | Effet | Rang |
|---|---|---|---|
| Printemps, jour 3 | **Foire aux semis** | Graines **−25 %** toute la journée (et pour le semoir) | 1 |
| Été, jour 4 | **Fête du village** | Récoltes vendues **+25 %** ce jour-là ; employés **joyeux** ; chambre d'hôte × 2 ce jour | 1 |
| Été jour 1 → automne jour 7 | **Comice agricole** (concours) | 3 épreuves tirées selon le rang, annoncées au 1er jour d'été, jugées le **soir du dernier jour d'automne**, avant les charges ; prix **100 × rang** par épreuve, **+ autant** pour les trois (Domaine : × 2). Moteur : `contest.js` (v3) | 2 |
| Automne, jour 2 | **Fête des récoltes** | Toutes les ventes **+15 %** ; +1 ♥ Joseph si une quête est en cours | 1 |
| Hiver, jour 4 | **Marché de Noël** | Produits transformés vendus ce matin-là **+50 %** ; stock du grenier **+25 %** toute la journée | 2 |

- Épreuves du comice (données, tirées avec le flux `events`, jamais deux fois la même la même année) : « N citrouilles » (N = 4 + rang), « N produits transformés » (6 + 3 × rang), « N fromages » (2 + rang), « N paniers de fruits » (4 + 2 × rang), « N œufs ramassés » (dizaines : 10 × rang), « N truffes » (rang), « Plus beau stock : N unités au grenier le jour du jugement » (20 × rang). Seules des épreuves **possibles** avec la ferme du joueur sont tirées.
- Bandeau la veille et le jour de chaque fête ; décor de fête dans la scène (guirlandes, stand, lampions, sapin de Noël) ; musique de festival le jour même.

### 8.2 Événements au hasard

Tirage **à l'aube** (flux `events`, carrière seulement) : **30 %** de chance par jour, jamais les 3 premiers jours de la carrière, jamais un jour de fête, jamais deux fois le même d'affilée ; **un seul** événement au hasard actif à la fois. Poids *(à régler)* :

| Événement | Poids | Condition | Déroulé |
|---|---|---|---|
| **Visiteur acheteur** (commande) | 30 | ≥ 1 culture de saison | « Mme Leblanc voudrait **6 tomates**, payées **× 1,5**. » Accepter / Refuser. Livrée depuis le grenier (bouton « Livrer ») ou avec les prochaines récoltes de cette culture (mises de côté, texte flottant « → Mme Leblanc ») ; **2 jours** ; pas de pénalité si c'est raté. |
| **Touristes** | 15 | chambre d'hôte, chevaux, mare ou embellissement | +5 × (1 + attrait) pièces par passage (3 passages dans la journée, textes flottants), petits personnages sur la route. |
| **Corbeaux** | 15 | hors hiver, ≥ 12 parcelles semées | 1 à 3 parcelles non mûres marquées d'un corbeau. **Toucher** la parcelle = le chasser (1 geste, envol). Un jardinier affecté le fait à sa prochaine action. Pas chassé à l'aube suivante → la récolte de cette parcelle vaut **−50 %** (pas de perte totale). |
| **Arc-en-ciel** | 10 | la veille était pluvieuse | Pousse **+10 %** aujourd'hui (tout le champ), arc dans le ciel. |
| **Rosée du matin** | 10 | printemps ou automne, pas de pluie | Toutes les parcelles sont arrosées ce matin. |
| **Marchand ambulant** | 10 | rang ≥ 2 | Propose **un** objet pour la journée : engrais (un champ : +25 % de pousse pendant 3 jours, 150), plant de cerisier (phase B), 2 poules à 40 les deux… Acheter / Non merci. |
| **Animal perdu** *(B)* | 5 | pas encore de chat (puis de chien) | « Un chaton miaule près du puits. L'adopter ? » Compagnon **décoratif** qui se promène (sans effet). |
| **Cadeau de Joseph** | 5 | ≥ 2 ♥ | Un panier de graines (les 8 prochaines graines gratuites) ou 30 pièces. |

Aucun événement ne détruit une culture, un animal ou un bâtiment (grêle, incendie, maladie des bêtes : écartés, voir `JOURNAL.md`).

### 8.3 Joseph : quêtes et amitié

- Joseph (le voisin du tutoriel) propose **une quête au début de chaque saison** à partir du rang 2 (au plus une quête active). Elle dure **jusqu'à la fin de la saison**.
- Modèles (données) : « Apporte-moi **N** <culture de saison> » (N = 6 + 2 × rang), « **N** <produit transformé> » (4 + rang), « **N** œufs » (8 × rang), « Un panier de **N** fruits » (4 + rang), « Plante **N** pommiers » (2, une fois). Livraison comme pour un visiteur (grenier ou prochaines récoltes / ventes mises de côté).
- Récompense : **1,5 × valeur** des objets + **3 écus** + **1 ♥**. Refuser ou rater : rien ne se passe (Joseph : « Pas grave, une autre fois ! »).
- **Amitié** (0 à 10 ♥, jamais perdue) : +1 par quête réussie, +1 quand un prêt est remboursé en entier.

| ♥ | Joseph… |
|---|---|
| 2 | … offre des cadeaux de temps en temps (§ 8.2) |
| 4 | … prête jusqu'à **2 fois plus** (plafond du § 1.7 × 2) |
| 6 | … prête **sans supplément** (0 %) |
| 8 | … vend « **Le verger de Joseph** » : le prochain terrain à acheter devient un verger déjà aménagé avec **4 pommiers adultes**, à **moitié prix** (une fois) |
| 10 | … vous lègue sa charrette : vendeur **+5 %** ; titre « Ami de Joseph » ; succès |

---

## 9. Économie et rythme

### 9.1 Courbe visée (joueur tranquille, Détente) *(à régler par la simulation)*

| Année | Rang (fin d'année) | Terrains | Employés | Machines | Bénéfice de l'année | Gestes / jour |
|---|---|---|---|---|---|---|
| 1 | 1 → 2 | 0-1 | 0 | — | ~800 | ~35 |
| 2 | 2 | 2-3 | 1 | arroseurs | ~1 500 | ~30 |
| 3 | 3 | 4 | 2 | + semoir (cheval) | ~3 000 | ~25 |
| 4 | 3 | 5-6 | 3 | + moissonneuse | ~5 000 | ~20 |
| 5 | 4 | 7 | 4 | + tracteur | ~8 000 | ~15 |
| 6-7 | 4 → 5 | 8-10 | 5-6 | niv. 2 | 11 000 à 15 000 | ~12 |
| 8-10 | 5 → 6 | 11-12 | 7-8 | tout | 20 000+ | ~10 |

Joueur appliqué (robot « optimal ») : **Domaine vers l'année 5-6**, jamais avant la fin de l'année 4.

### 9.2 Repères de rentabilité (Détente)

- Champ de 16 parcelles bien tenu : ≈ 50 (carottes) à 90 (tomates, maïs) par jour d'été ; rien en hiver hors navets et choux. Rembourse terrain + aménagement (400 + 150) en ~1 saison au début ; les terrains suivants (plus chers) en 1 à 2 ans : c'est voulu (**les coûts grandissent plus vite que les revenus d'un terrain**, la croissance ralentit en douceur).
- Employé niv. 1 (8 / jour, 14 actions) : rentable dès qu'il tient un champ entier en été ; coûteux en hiver → **congés d'hiver** (l'arbitrage d'hiver de la carrière).
- Poule : 30 pour 2 / jour (15 jours) ; vache : ~170 pour 16 − 3 / jour (13 jours) ; cochon : ~150 pour ~250 / an de truffes en automne et en hiver.
- Machines : rentables quand le terrain est grand et la ferme occupée ; leur premier intérêt est **d'épargner des gestes**.

### 9.3 Puits d'argent de fin de partie

Terrains 10 à 12 (31 400), maison niv. 5 (10 000), grand silo (4 000), ateliers niv. 5, serre chauffée, château d'eau et convoyeur, embellissements (20 500), comice régional. Après le Domaine, les records (meilleure année, patrimoine) et les succès restent à chasser.

### 9.4 Sécurité « Détente »

- Charges proportionnelles à la taille ; salaires et carburant jamais prélevés en négatif ; stock et ateliers vendus avant tout ; Joseph ; coup dur ; vente de secours limitée aux animaux et machines. **Jamais de fin de partie en Détente.**
- Conseil doux (une fois par saison, 3 jours avant des charges mal parties) : « Pensez à mettre l'équipe en congé » / « Vendez un peu de stock » / « Joseph pourra vous avancer environ X pièces ».

---

## 10. Interface (téléphone en portrait d'abord)

### 10.1 Menu principal

Boutons pleine largeur (≥ 56 px) : **Ma ferme** (sous-titre « Continuer · Année 3 · Belle ferme » ou « Commencer ma ferme ») · **Les niveaux** · La grange aux souvenirs · Options · Crédits (· Installer le jeu). Derrière le menu, la ferme de démonstration montre **la ferme de carrière** quand elle existe.

**Nouvelle ferme** (feuille haute) : nom de la ferme (champ texte, 18 caractères, pré-rempli), difficulté (les deux grandes options de la v3 : Détente recommandé / Classique), « Commencer ». Puis 3 bulles de Joseph : « Bienvenue chez vous ! La ferme est petite, mais la forêt au-dessus est à vendre, terrain par terrain… », « Chaque saison, il y a des charges : 20 pièces pour commencer. », « Je vous ai laissé deux poules. Touchez le poulailler pour ramasser les œufs ! ». Le tutoriel complet du niveau 1 n'est **pas** rejoué ; si le niveau 1 n'a jamais été gagné, une option « Suivre le tutoriel » propose ses étapes (planter, arroser, récolter) sur le champ de départ.

### 10.2 En partie : barre du haut et onglets

- **Barre du haut** (2 lignes, inchangée dans sa forme) : argent · « Année 3 · Été 4/7 » ; météo → demain · **charges de saison** (montant, jours, couleur) · vitesse. Toucher l'argent : fiche finance (charges quotidiennes détaillées : ferme, entretien, **salaires**, **carburant**, solaire ; dette de Joseph).
- **Onglets du bas** (5, ≥ 56 px de haut, ≥ 72 px de large à 360 px) : **Ferme** (re-toucher → Carte) · **Acheter** · **Équipe** (verrouillé « Rang 2 » avant) · **Carnet** · **Menu**. Pastille sur Carnet quand une quête, une offre ou un objectif est nouveau ; sur Équipe quand de nouveaux candidats arrivent.

### 10.3 Acheter

Sections repliables (en-têtes ≥ 48 px), cartes v3 : **Terrains** (le prochain terrain + « Voir la carte ») · **Animaux** (par abri : « Poulailler 3 / 4 · Poule 30 · +2 / jour · ramasser » ; abri plein → « Améliorer le poulailler ») · **Machines** (carte : effet, prix, carburant, « Installer sur… » → liste des terrains compatibles) · **Bâtiments** (maison, grenier, serre, étal, chambre d'hôte, abris : niveau actuel en pastilles, niveau suivant, prix) · **Ateliers** · **Aménagements** (ruches, panneaux, embellissements). Un élément verrouillé : grisé, « Rang 4 ».

### 10.4 Carte des terrains (feuille haute)

Liste de haut en bas, comme la ferme : une ligne par terrain (≥ 64 px) : icône du type, nom, résumé (« Champ · 16 parcelles · arroseurs niv. 2 · Lucie »), bouton « Aller » ; le terrain à vendre en tête (« Le Haut-Champ · 900 · +15 par saison » + « Acheter », ou « Rang 3 requis ») ; en bas, maison / champ de départ / basse-cour.

### 10.5 Fiche d'un terrain

En-tête : nom (renommable, § 15), type, « Réaménager » (s'il est vide). Contenu selon le type, en sections :

- **Champ / serre** : **Plan de culture** (4 lignes : saison → culture ou « Même culture » ou « Rien ») · **Machines** (une ligne par machine : niveau, interrupteur ≥ 48 px, « Améliorer » ; absente : « Installer · 500 ») · **Équipe** (jardiniers affectés, « Affecter quelqu'un ») · Ruches.
- **Pré** : les 2 emplacements (abri : animaux n / capacité, à ramasser, « Ramasser », « Améliorer ») ; emplacement libre : « Construire » → liste des abris et de la chambre d'hôte.
- **Verger** : arbres (étapes), cueilleuse, jardiniers.
- **Cour des ateliers** : les 2 emplacements (fiche d'atelier v3 par bouton « Ouvrir »), artisan.
- **Mare** : canards, « Pêcher » (1 fois par jour, § 10.9), soigneur.

### 10.6 Équipe

- Liste (lignes ≥ 72 px) : portrait (32 × 32 agrandi), prénom, métier + terrain (« Jardinière · Le Haut-Champ »), niveau (pastilles) et barre d'expérience, humeur (icône), salaire, interrupteur « Congé ». En tête : « 3 / 4 employés · salaires 33 / jour » et « Toute l'équipe en congé ».
- Toucher une ligne → **fiche de l'employé** : grand portrait, trait (une phrase), métier (4 boutons segmentés ≥ 56 px avec icônes), affectation (liste des terrains compatibles, ≥ 56 px), statistiques de l'année, « Renvoyer » (secondaire, confirmation).
- « **Embaucher** » (bas de la liste) → feuille des 3 candidats (cartes : portrait, prénom, trait, niveau, salaire, métier conseillé, « Embaucher ») ; « Nouveaux candidats dans 4 jours ».
- Dans la scène, **toucher un employé** ouvre sa fiche.

### 10.7 Carnet (le « hub » de la carrière)

Onglets segmentés (≥ 48 px) : **Ferme** · **Bilan** · **Agenda** · **Joseph**.

- **Ferme** : blason du rang, nom de la ferme, titre du fermier, **patrimoine** (barre vers le seuil suivant), les 2 **objectifs** du rang suivant (cases, progression « 63 / 100 récoltes »), aperçu des déblocages du rang suivant (icônes grisées).
- **Bilan** : celui de la v3 (saison, année, transformation) + salaires, carburant, charges de saison, stock (valeur), et « **Années passées** » (barres simples du bénéfice par année, meilleure année).
- **Agenda** : fêtes de l'année (passées cochées, prochaine en tête avec compte à rebours), comice (épreuves avec barres), événement actif, commandes des visiteurs, quête de Joseph (progression, « Livrer depuis le grenier »).
- **Joseph** : portrait, cœurs, prochain cadeau d'amitié, dette et « Rembourser » (v3).

### 10.8 Fenêtres et messages

- **Événements** : un message (toast) avec action « Voir » ; les offres (visiteur, marchand, adoption, quête) s'ouvrent en **petite feuille** (illustration 64 px, texte de 2 lignes, 2 boutons pleine largeur ≥ 56 px). **Aucune** ne met le jeu en pause d'office, sauf le passage de rang, le bilan annuel, le coup dur et la faillite (Classique).
- **Bilan de l'année** (fenêtre haute, pause) : « Année 3 terminée ! », bénéfice (gros chiffre), revenus par source (récoltes, produits, animaux, visiteurs et fêtes, quêtes, stock vendu), dépenses (graines, salaires, carburant, charges, entretien, achats), meilleure culture, rang et objectifs, écus gagnés, succès ; bouton « Commencer l'année 4 » (≥ 56 px).
- **Passage de rang**, **Coup dur**, **Vente de secours** (liste de ce qui a été vendu), **Faillite** (Classique) : fenêtres plein écran avec Joseph.
- **Conseils « première fois »** (bulle, pause `hint`) : `career.start`, `career.collect` (premier abri avec des œufs), `career.lotForSale` (premier terrain achetable), `career.plan` (premier champ acheté), `career.hire` (maison niv. 2), `career.leave` (premier hiver avec des employés), `career.machine` (première machine), `career.storage` (grenier), `career.quest` (première quête), `career.crows` (premiers corbeaux), `career.yearEnd`.

### 10.9 Gestes dans la scène (en plus de ceux des niveaux)

| Toucher… | Effet |
|---|---|
| un abri (ou son enclos) avec des produits | **ramasser** ; sans produit → fiche de l'abri |
| une parcelle avec un corbeau | le **chasser** (avant toute autre action) |
| le panneau d'un terrain | fiche du terrain |
| le panneau « À vendre » | feuille d'achat du terrain |
| un employé | fiche de l'employé |
| une machine garée | fiche du terrain, section Machines |
| la mare (ponton) | **pêcher** (1 fois par jour : poisson de 5 à 40 pièces, flux `events`) ; déjà fait → fiche de la mare |
| le grenier / la maison | fiche du bâtiment |
| appui long sur n'importe quoi | sa fiche |

Glisser sur un champ : arroser / récolter en série (inchangé) ; sur des abris : ramasser en série.

### 10.10 Ordinateur

Même interface ; onglets dans la barre du haut, feuilles à droite ; molette = défilement ; raccourcis en plus : **C** carte, **E** équipe, **J** carnet.

---

## 11. Graphismes à produire (agent graphique)

Style : **Kenney Tiny Farm / Tiny Town**, dessinés par programme comme la v3 (`assets/sprites/generate-career.py` → `assets/sprites/career.png`, bloc `// <career:auto>` … `// </career:auto>` de `src/render/atlas.js`), palette et contour de la v3 (contour (63, 38, 49) de 2 px, lumière en haut à gauche), tuiles de **16 px**. Tout est CC0 (dérivé de Kenney) ou dessiné pour le projet : **ligne dans `CREDITS.md`**. Chaque animal : regard vers la gauche (le rendu retourne l'image), 2 images de marche + 1 image « au repos » au minimum.

**Phase A**

| Nom (atlas) | Taille (tuiles) | Images | Notes |
|---|---|---|---|
| `animal.pig`, `.walk.1`, `.sniff` | 1 × 1 | 3 | cochon rose ; « sniff » = museau au sol (truffe) |
| `animal.rabbit.white`, `.brown` (+ `.hop`) | 1 × 1 (petit) | 2 × 2 | lapins angora (touffus) |
| `animal.horse`, `.walk.1`, `.graze` | 2 × 2 | 3 | cheval brun, crinière claire |
| `animal.hen` | 1 × 1 | réutiliser `animal.chicken` | — |
| `building.pigsty.1`, `.3` | 3 × 3 | 2 | porcherie (niv. 1, niv. 3 agrandie) + boue |
| `building.hutch.1`, `.3` | 2 × 2 / 3 × 2 | 2 | clapier sur pieds |
| `building.stable.1`, `.3` | 3 × 3 | 2 | écurie, porte à deux battants |
| `building.sheepfold.1`, `.3`, `building.goatShed.1`, `.3`, `building.cowshed.1`, `.3`, `building.coop.1`, `.3` | 3 × 3 | 8 | versions niv. 1 et 3 (annexe, toit agrandi) des abris existants |
| `building.house.1` → `.5` | 4 × 3 → 6 × 4 | 5 | maisonnette (existante), maison, grande maison (étage), corps de ferme (aile), **manoir** (tour, fanion) ; `.5.flag` doré pour le Domaine |
| `building.storage.1`, `.2`, `.3` | 2 × 3 · 2 × 4 · 4 × 4 | 3 | grenier bois, silo métal, double silo |
| `building.guestHouse.2`, `.3` | 4 × 3 · 5 × 3 | 2 | chambre d'hôte agrandie |
| `building.stand.2` | 4 × 2 | 1 | boutique de la ferme |
| `machine.tractor.l`, `.l.1`, `.r` (+ attelage) | 2 × 2 | 3 | tracteur rouge (Kenney), roues animées |
| `machine.seeder`, `.seeder.1` | 2 × 1 | 2 | semoir (bac + roues) |
| `machine.harvester`, `.1` | 3 × 2 | 2 | moissonneuse verte, rabatteur animé |
| `machine.fruitPicker` | 2 × 2 | 1 | échelle-chariot, paniers |
| `machine.collector` | 1 × 1 | 1 | mangeoire-tapis à œufs |
| `sprinkler.lot` | réutiliser les têtes d'arroseur existantes | — | |
| `staff.<look>` | 1 × 1 | 32 apparences × 3 (repos, marche, action) | à partir des 4 tenues v3 : chapeau / sans, 4 teintes (cheveux + peau) ; **outils** tenus : `tool.can`, `tool.basket`, `tool.seedbag`, `tool.pail` (1 × 1, par-dessus le personnage) |
| `portrait.staff.<look>` | 2 × 2 (32 px) | 32 | tête et épaules pour l'interface |
| `npc.joseph`, `portrait.joseph` | 1 × 1 · 2 × 2 | 3 + 3 expressions | Joseph : vieux fermier, casquette, moustache blanche (content, surpris, fier) |
| `npc.visitor.1` → `.3` | 1 × 1 | 2 chacun | villageois (dame au panier, touriste, enfant) |
| `land.stump`, `land.tallgrass.*`, `land.wildflower.*`, `land.sale.sign` | 1 × 1 | ~8 | friche, panneau « À vendre » (pancarte rouge), panneau de terrain (bois) `land.sign` |
| `ground.cobble.*` | autotuile 3 × 3 + variantes | 12 | pavés de la cour des ateliers |
| `bird.crow`, `.fly.1`, `.fly.2` | 1 × 1 | 3 | corbeau posé et envol |
| `product.truffle`, `product.eggs`, `product.angora`, `product.milk` | 1 × 1 | 4 | icônes et bulles de ramassage |
| `bubble` (cadre de bulle) | 1 × 1 (9 tranches) | 1 | bulle au-dessus des abris |
| `fair.bunting`, `fair.stand`, `fair.lanterns`, `fair.xmasTree`, `fair.chalet`, `fair.ribbon` | 1 × 1 à 3 × 2 | 6 | décor de fêtes (guirlandes, stand rayé, lampions, sapin, chalet du marché de Noël, cocarde du comice) |
| icônes d'interface `icon.career.*` | 1 × 1 | ~30 | terrain, carte, plan, équipe, métiers (4), traits (7), humeur (3), machines (8), rangs (6 blasons), quête, cœur, agenda, grenier |
| `icon.ach.<id>` | 1 × 1 | 17 (+ grisées) | succès de carrière |

**Phase B** : `animal.duck`, `.swim`, `.walk.1` (1 × 1) ; `water.*` (autotuile de mare 3 × 3 + coins intérieurs, nénuphar, roseaux, 2 images d'eau) ; `pond.dock` (3 × 1) ; `product.fish.1-3`, `product.duckEgg` ; `building.greenhouse.1` → `.3` (10 × 7 en tuiles de verre `glass.*` réutilisables, cheminée et lueur pour le niveau 3) ; `building.cannery`, `building.spinningMill` (3 × 3) + produits `product.tomatoSauce`, `product.pumpkinSoup`, `product.ratatouille`, `product.yarn` ; niveaux 4-5 des ateliers (enseigne dorée, annexe) ; `machine.waterTower` (2 × 4), `machine.conveyor.h|v` (1 × 1, 2 images) ; `building.stand.3` (marché fermier 5 × 3) ; embellissements `embellish.fountain` (2 × 2, eau animée), `.bandstand` (3 × 3), `.statue` (2 × 2), `.garden` (4 × 3) ; `tree.cherry.*`, `tree.pear.*` (mêmes étapes et saisons que le pommier, fruits) + `product.cherryJam`, `product.pearJuice` ; `pet.cat.*`, `pet.dog.*` (1 × 1, assis, marche × 2) ; `effect.rainbow` (arc en surimpression, dessiné par `effects.js` plutôt qu'en sprite si plus simple).

---

## 12. Rendu et audio (principes)

- `layout-career.js` construit la colonne à partir de `state.career.lots` (même forme que les dispositions existantes : `plots`, `slots`, `decorSlots`, `fieldRect`, `essential`, + `lots: [{ id, type, rect }]`). Les index des parcelles sont ceux du cœur (ajoutées **à la fin** quand un champ est aménagé, jamais renumérotées).
- **Employés** : chaque personnage lit `staff[i].task` (`{ kind, target, startAt, doneAt }`, § ARCHITECTURE) et **interpole** sa position entre son point de départ et sa cible ; arrivé, il joue l'animation de l'action (arrosoir + gouttes, panier + légume qui saute, sac de graines) ; trajet en ligne droite par le chemin du terrain (pas de recherche de chemin) ; à ×4 tout va 4 fois plus vite ; au repos, il flâne près de la maison. Hors de l'écran : rien n'est dessiné.
- **Machines** : la moissonneuse et le semoir traversent le champ **rang par rang** pendant leur passage (événement `machineWorked` avec la liste des parcelles et l'heure de chaque parcelle) ; le tracteur les tire (sinon le cheval) ; sinon ils restent garés.
- **Animaux** : 6 au plus dessinés par abri ; bulle de ramassage quand il y a quelque chose (au-dessus du toit).
- **Terrains** : forêt dense au-dessus ; terrain à vendre assombri avec son panneau ; animation de défrichage à l'achat ; décor de fête selon le calendrier.
- **Audio** : cris du cochon, du cheval, des canards et des lapins (Kenney / Freesound CC0, lignes dans `CREDITS.md`), moteur de tracteur doux (boucle courte, volume bas), scie (défrichage), fanfare de rang (réutiliser la victoire), accordéon de fête.

---

## 13. Simulation (`tools/simulate-career.js`)

Nouvel outil (le simulateur des niveaux ne change pas). Joue une carrière **par l'API publique seulement**, N années (défaut 10), déterministe (graine × stratégie ; tirages humains sur un flux à part, comme `simulate.js`).

### 13.1 Robots

| Robot | Modèle |
|---|---|
| **casual** (joueur tranquille ×1) | Profil « casual » de `simulate.js` sur le champ de départ et les champs **non automatisés** (gestes par jour limités : 7 à 11 « glisser » + ramasser un abri sur deux par jour) ; achète un terrain quand l'argent dépasse prix + aménagement + charges de 2 saisons ; aménagement suivant une liste d'envies (champ, pré (poules → chèvres → vaches), cour des ateliers, verger, champ…) ; embauche dès que possible un jardinier pour le champ le moins bien tenu ; arroseurs puis semoir puis moissonneuse ; met l'équipe en congé en hiver 1 fois sur 2 ; accepte 70 % des quêtes et des visiteurs ; chasse les corbeaux 60 % du temps ; grenier en « quand le cours est bas », vend tout au Marché de Noël. |
| **novice** | Profil novice ; achète sans regarder les charges ; n'utilise jamais les congés ; plan « même culture » partout. |
| **optimal** | Valeur attendue de chaque achat (revenu restant sur 2 ans − coût − salaires/carburant) ; congés quand un employé coûte plus qu'il ne rapporte ; stocke et vend au meilleur cours ; plan de culture le plus rentable par saison. |
| **idle** | Joue la 1re année comme casual, puis **ne fait plus rien** (ni geste ni achat) : vérifie qu'aucun état n'est irrécupérable et que la ferme tourne seule sans ruine (chômage technique, vente de secours). |
| **automator** | Comme optimal mais **aucun geste** à partir de l'année 3 : mesure la part « idle » de la fin de partie. |

### 13.2 Mesures

Rang, patrimoine, argent (min, fin), bénéfice par année ; revenus par source ; gestes par jour (joueur, et part faite par employés et machines) ; prêts de Joseph, coups durs, ventes de secours ; revenus animaux perdus (abris pleins) ; corbeaux non chassés ; quêtes réussies ; temps passé par année (jours × 20 s).

### 13.3 Cibles (Détente, 50 graines × 10 ans)

| Cas | Cible |
|---|---|
| casual | rang 2 à la fin de l'année 1 dans ≥ 70 % (année 2 : ≥ 95 %) ; rang 3 à l'année 3 (≥ 70 %) ; rang 4 à l'année 5 ; rang 5 à l'année 7 ; **Domaine à l'année 10 dans ≥ 50 %** |
| optimal | Domaine entre les années 5 et 7 ; **jamais** avant la fin de l'année 4 |
| novice | rang 3 à l'année 5 (≥ 70 %) ; ≤ 1 vente de secours en 10 ans dans ≥ 95 % des carrières |
| tous (Détente) | aucun argent < −(charges de saison) plus de 2 saisons de suite ; après un coup dur, argent ≥ 0 en ≤ 2 saisons (casual : ≥ 99 %) ; aucune fin de partie |
| idle | pas de fin de partie ; patrimoine qui ne tombe jamais sous la moitié de celui de fin d'année 1 |
| délégation | casual : gestes par jour **année 5 ≤ 45 %** de ceux de l'année 1 pour une ferme ≥ 4 fois plus grande ; automator : ≥ 60 % du bénéfice sans aucun geste en fin de partie |
| rythme | durée d'une année à ×1 : 28 jours × 20 s (inchangé) ; bénéfice casual croissant d'une année à l'autre jusqu'à l'année 8 au moins |
| « le toucher compte » | casual avec récolte à la main vs même robot sans (tout par employés) : +5 à +15 % de bénéfice |
| Classique | casual : faillite ≤ 30 % des carrières en 10 ans ; optimal : 0 % |
| **mode Niveaux** | `node --test tests/` vert, parité identique (`tests/parity.test.js`), `node tools/simulate.js` identique à avant |

Commandes : `node tools/simulate-career.js` (tous les robots, Détente), `--strategy casual --years 10 --runs 50`, `--difficulty classique`, `--trace --seed 3` (une carrière jour par jour), `--csv` (courbes par année).

### 13.4 Résultats (lot CORE-C, 2026-09-30 : employés, machines, animaux, événements, quêtes, comice)

Robots réalistes (budget de gestes par jour comme `tools/simulate.js`, décisions d'équipe et de machines de
`tools/sim-career-staff.js`), 20 carrières × 10 ans par réglage. Rang médian à la fin de chaque année, et part des
carrières au rang visé par la courbe du § 9.1 (an 1 → 2, an 3 → 3, an 5 → 4, an 7 → 5, an 10 → 6) :

| Réglage | Robot | An 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | Domaine (méd.) | Faillites |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Détente 7 j | casual | 2 (75 %) | 2 | 3 (80 %) | 4 | 4 (100 %) | 5 | 5 (100 %) | 5 | 6 | 6 (100 %) | an 9 | 0 % |
| Détente 7 j | novice | 1 | 2 | 2 | 2 | 3 | 4 | 4,5 | 5 | 5 | 5 | jamais (10 %) | 0 % |
| Détente 7 j | optimal | 2 | 2 | 4 | 5 | 5 | 6 | 6 | 6 | 6 | 6 | an 6 (0 % avant la fin de l'an 4) | 0 % |
| Détente 7 j | automator | 2 | 2 | 4 | 5 | 5 | 5 | 6 | 6 | 6 | 6 | an 7 | 0 % |
| Détente 7 j | idle | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | — | 0 % |
| Détente 10 j | casual | 2 | 2 | 4 | 4 | 5 | 5 | 5,5 | 6 | 6 | 6 | an 7,5 | 0 % |
| Détente 10 j | optimal | 2 | 4 | 5 | 5 | 6 | 6 | 6 | 6 | 6 | 6 | an 5 | 0 % |
| Détente 14 j | casual | 2 | 3 | 4 | 5 | 5 | 5 | 6 | 6 | 6 | 6 | an 7 | 0 % |
| Détente 14 j | optimal | 2 | 4 | 5 | 5 | 6 | 6 | 6 | 6 | 6 | 6 | an 5 | 0 % |
| Classique 7 j | casual | 1 | 2 | 2 | 3 | 4 | 4 | 4 | 5 | 5 | 5 | jamais (10 %) | 5 % |
| Classique 7 j | optimal | 2 | 3 | 4 | 4 | 5 | 5 | 5 | 6 | 6 | 6 | an 8 | 0 % |
| Classique 10 j | casual | 1 | 2 | 3 | 4 | 4 | 5 | 5 | 5 | 6 | 6 | an 9 | 5 % |
| Classique 14 j | casual | 1 | 2 | 3 | 4 | 5 | 5 | 5 | 6 | 6 | 6 | an 8 | 10 % |
| Classique | novice / idle | | | | | | | | | | | — | 85 à 100 % |

- **Cibles tenues (Détente, 7 j)** : casual rang 2 fin d'an 1 dans 75 % (an 2 : 100 %), rang 3 à l'an 3 dans 80 %,
  rang 4 à l'an 5 et rang 5 à l'an 7 dans 100 %, Domaine en médiane à l'an 9 (100 % à l'an 10) ; optimal : Domaine
  à l'an 6 (entre 5 et 7), jamais avant la fin de l'an 4 ; idle : jamais de fin de partie, patrimoine qui monte
  lentement ; automator (aucun geste dès l'an 3) : ≈ 82 % du bénéfice de l'optimal en fin de partie (cible ≥ 60 %) ;
  délégation : gestes du casual à l'an 5 = 44 % de ceux de l'an 1 (2,7 contre 6,2), part des récoltes et semis faits
  à la main 2 à 4 % dès l'an 4 ; Classique : casual 5 à 10 % de faillites, optimal 0 %. Aucune vente de secours
  pour le casual et le novice ; produits animaux perdus ≤ 1 % (plafond de 3 jours gardé).
- **Presque** : novice rang 3 à l'an 5 dans 65 % (cible 70 %).
- **Événements vivants** : ≈ 10 à 16 % des revenus du joueur tranquille (visiteurs 150 à 400 par an, quêtes 400 à
  800, comice 400 à 3 000, touristes et pêche quelques dizaines) ; 3 à 4 quêtes réussies par an ; 10 ♥ vers l'an 5
  (casual) ; comice réussi (3 épreuves) en médiane 5 fois en 10 ans (casual), 6 (optimal).
- **Réglages faits** : rang 2 « Faire 60 récoltes » (80 : rang 2 fin d'an 1 dans 37 % seulement, le joueur passe
  aussi ses gestes aux abris, aux visiteurs et à Joseph) ; seuil du Domaine 100 000 (70 000 : Domaine à l'an 8 pour
  le joueur tranquille) ; épreuve « stock » 15 × rang avec un grenier ≥ 1,5 × la cible (le vendeur vend au bon
  cours) ; l'objectif « 20 produits transformés » est gardé (il suffit de planter des fraises pour la confiturerie).
- **À surveiller** : avec des saisons de 10 ou 14 jours tout va plus vite (Domaine an 7 à 7,5 pour le casual, an 5
  pour l'optimal, qui atteint même le rang 6 dès l'an 4 dans certaines carrières de 14 jours) : les objectifs
  comptés (récoltes, produits, quêtes, comice) ne sont pas multipliés par la durée et la croissance se compose plus
  vite dans une année plus longue. Piste : objectifs comptés × durée / 7 et seuils × (durée / 7)^1,3.
  Le novice en Classique fait presque toujours faillite : l'écran de création recommande déjà Détente.

---

## 14. Plan de réalisation

Les **contrats** (formes des données, de l'état, actions, requêtes, événements, API de scène, noms de sprites, propriété des fichiers) sont dans `docs/ARCHITECTURE.md`, section « Mode Carrière — contrats ». Chaque lot peut commencer tout de suite contre ces contrats (objets factices en attendant les autres).

| Lot | Contenu | Possède (seul à modifier) |
|---|---|---|
| **CORE-A** Socle | Mode et années continues (hooks dans `game.js`), charges de saison, terrains et aménagements, bâtiments et niveaux, rangs et patrimoine, marché de carrière, grenier, coups durs, sauvegarde (clé, secours, migration), progression (`progress.career`, succès de carrière) | `src/core/game.js`, `src/core/farm.js`, `src/core/economy.js`, `src/core/calendar.js`, `src/core/neighbour.js`, `src/core/progression.js`, `src/storage.js`, `src/data/career/{career,lots,buildings,ranks}.js`, `src/data/achievements.js`, `src/core/career/{career,land,buildings,ranks,market,storage,save}.js`, `tests/career-{core,land,buildings,save}.test.js` |
| **CORE-B** Automatisation et équipe | Machines, employés (candidats, métiers, tâches, niveaux, humeur, congés), animaux de carrière et ramassage | `src/data/career/{machines,staff,animals,names}.js`, `src/core/career/{machines,staff,work,animals}.js`, `tests/career-{machines,staff,animals}.test.js` |
| **CORE-C** Vie et simulation | Calendrier des fêtes, comice, événements au hasard, quêtes et amitié de Joseph, simulateur de carrière | `src/data/career/{events,quests}.js`, `src/core/career/{events,quests}.js`, `tools/simulate-career.js`, `tests/career-{events,quests,simulate}.test.js` |
| **UI** | Menu principal, nouvelle ferme, onglets de carrière, Acheter (sections), Carte, fiche de terrain, Équipe, Carnet, fiches de bâtiment et d'abri, offres et fenêtres, bilan annuel, conseils ; câblage `main.js` (création / chargement / sauvegarde de la carrière) | `src/ui/*` (nouveaux : `src/ui/career/*.js`), `css/style.css`, `src/main.js`, `src/index.template.html` |
| **RENDER** | `layout-career.js`, scène (terrains, défrichage, abris, animaux, employés, machines, bulles, corbeaux, fêtes), atlas (hors bloc auto), hit-test | `src/render/*` (nouveau : `src/render/layout-career.js`, `src/render/career-actors.js`) |
| **ART** | Planche `career.png`, générateur, bloc auto de l'atlas, sons, crédits | `assets/sprites/generate-career.py`, `assets/sprites/career.png`, `assets/audio/sfx/*` (ajouts), bloc `<career:auto>` d'`atlas.js`, `CREDITS.md` |

**Ordre** : (0) CORE-A pose les points d'accroche et un `createCareer()` minimal qui joue une année continue sans rien de neuf (jalon « squelette », parité verte) — les autres lots partent de là ; (1) **Phase A** en parallèle ; (2) intégration par le chef de projet (tests, simulation, build, journal, sauvegarde `backup/…`) ; (3) équilibrage (CORE-C avec CORE-A/B) ; (4) **Phase B** ; (5) intégration.

Critères d'acceptation communs : `node --test tests/` vert (parité comprise), `node tools/build.js --check` à jour, Playwright au doigt (Pixel 7, 360 × 740) : cibles ≥ 48 px, textes ≥ 12 px, aucun débordement, une année de carrière jouée au doigt, achat d'un terrain, embauche, machine, bilan annuel, reprise de la sauvegarde ; aucune erreur de console.

---

## 15. Questions ouvertes (défauts recommandés)

| Question | Défaut recommandé |
|---|---|
| Longueur des saisons en carrière (7 jours, ou 10 pour plus de temps par saison ?) | **7 jours** (année ≈ 10 min, cohérent avec les niveaux) ; option « saisons longues (10 j) » à étudier après les premiers retours |
| Le plafond de ramassage (3 jours) est-il trop punitif ? | **3 jours**, 4 si la simulation montre > 5 % de revenus animaux perdus pour le joueur tranquille |
| Titre au féminin | Option « Je suis : fermier / fermière » dans « Nouvelle ferme » (accorde titres et textes de Joseph) |
| Renommer les terrains | Oui (18 caractères, comme le nom de la ferme), phase B |
| Plusieurs carrières en parallèle | **Non** : une seule ferme + archive des anciennes (simplicité, une seule sauvegarde à protéger) |
| Les étoiles/bonus en carrière | **Non** (§ 1.6) |
| Crédit pour acheter la terre | Pas en phase A ; idée gardée (paiement en 4 saisons, +10 %) |
| Faut-il un mode encore plus doux (« Zen », sans charges) ? | Non pour l'instant : Détente ne connaît déjà pas de fin de partie |
| Progression hors ligne | **Non** (règle d'or 5) |
| Terrains achetables dans le désordre / choix de la position | Non : toujours le suivant (colonne continue, rendu simple) |
| Animaux en unités individuelles (poule) plutôt qu'en « poulaillers » comme dans les niveaux | **Unités** (plus lisible quand l'abri grandit) ; les chiffres des niveaux ne changent pas |
| Récolte « à la main » +10 % | Oui (garde l'envie de toucher) ; à confirmer par la mesure « le toucher compte » |

## 16. Décisions de l'utilisateur (2026-09-30)

- **Pas de production hors jeu** : le temps s'arrête quand on quitte le jeu.
- **Durée des saisons réglable** à la création de la ferme : 7, 10 ou 14 jours (7 par défaut). Les coûts et gains journaliers restent identiques ; les charges de saison et les paliers sont ajustés par jour de saison pour que l'année reste équilibrée quelle que soit la durée.
- **Création de la ferme** : nom de la ferme, **fermier ou fermière** (titre et apparence du personnage), tenue parmi celles débloquées, difficulté (Détente sans fin de partie / Classique où la faillite termine la carrière).
