# La Vallée vivante — conception (2026-10-03)

Le **grand projet long du mode Carrière** : la Vallée qui revient (faune, paysage) et la Grainothèque vivante (variétés
anciennes), réunies en un seul fil, raconté par Joseph. Choix de l'utilisateur (2026-10-02, confirmé le 2026-10-03) ;
idéation : `docs/analyse/5-idees-projet-long.md` § 4. Contrats de code du lot V1 : `docs/ARCHITECTURE.md`, « Vallée
vivante — contrats du lot V1 » ; lot V2 « Le troc et les croisements » : conception détaillée au **§ 16**, contrats « Vallée
vivante — contrats du lot V2 » ; lot V3 « Le ruisseau » : conception détaillée au **§ 17**, contrats « Vallée vivante —
contrats du lot V3 » ; lot V4 « Les cigognes » : conception détaillée au **§ 18**, contrats « Vallée vivante — contrats du
lot V4 ». Résumé : `docs/GAME_DESIGN.md` § 18.

Les chiffres sont des **valeurs de départ** : ils seront réglés par la simulation (`tools/simulate-career.js
--compare-valley`, § 12) et la version qui fait foi vivra dans `src/data/career/valley.js`. Les noms de variétés marqués
(†) sont de vraies variétés anciennes françaises du domaine public ; les autres sont inventés pour la vallée.

---

## 0. En bref

**L'histoire.** La vallée autour de la ferme s'est tue : plus de haies, plus de bêtes, plus de semences du pays. Joseph
garde la boîte en fer de sa mère (sa première veillée, « La boîte en fer ») et des souvenirs de la vallée d'avant (les
haies, le ruisseau, les écrevisses, les cigognes). Le projet de toute une carrière : **faire revivre la vallée, graine
par graine, bête par bête**.

**En une phrase de jeu.** Le joueur **sauve des variétés anciennes** en les semant et en les récoltant **de ses mains**
(la récolte à la main garde les graines), et **fait revenir la faune** en aménageant sa ferme (haies, bandes fleuries,
nichoirs, mare, jachères) ; chaque bête venue, il va la **voir** d'un toucher ; chaque espèce et chaque variété est un
« signe de vie » qui fait avancer **les étapes de la vallée**, visibles autour de la ferme et entendues dans ses chants.

**Ce que ça résout** (diagnostic de `docs/analyse/0-SYNTHESE.md`) :

| Problème | Réponse de la Vallée |
|---|---|
| L'argent n'a plus d'usage (≈ + 35 000 à + 42 000 par an après l'an 10, 165 000 en caisse à l'an 14 pour le joueur tranquille simulé) | Il achète **de la vie et du paysage** : haies, nichoirs, mare, puis (V2) la Grainothèque, (V3) les chantiers des lieux de la vallée et les terres sauvages — ≈ 450 000 pièces de puits « pour la beauté », qui ne rapportent presque rien. |
| La ferme se joue toute seule | La nature ne s'automatise pas : ouvrir un bocal, semer une planche d'essai, récolter à la main pour garder les graines, observer une bête, cueillir les haies — **jamais** l'équipe ni les machines (principe F1). |
| La routine ne change jamais, une culture domine | Chaque variété a un **trait** (précoce, sobre, rustique…) : la meilleure culture dépend de la saison et de la ferme ; chaque bocal est une surprise. |
| Le jeu libre après le Domaine est vide | Le V1 dure jusqu'à l'an 9 à 11 (joueur tranquille), les lots suivants jusqu'à l'an 16 à 20. |

**Pourquoi ce n'est pas la restauration du village de Stardew.** Aucun panier « une de chaque chose », aucun bâtiment
public réparé, aucune récompense par salle. L'objectif naît de **façons de cultiver** (sélection paysanne, haies,
jachères) et se mesure en **vie revenue**, sur la ferme et autour d'elle. Le joueur ne rend pas un service au village : il
fait de sa propre ferme un paysage vivant, et la vallée lui répond. Même les lieux de la vallée (V3) ne reviennent pas
« contre des objets » : un chantier paie le travail (curer le lit du ruisseau, replanter le bois), mais le lieu ne revient
que si la ferme lui en donne les moyens (les haies retiennent l'eau, les jachères ressèment la prairie) et prend des
saisons à reprendre.

### Règles d'or

1. **Carrière seulement.** Toute règle est gardée par `state.career.valley` ; le mode Niveaux (Détente et Classique), sa
   parité (`tests/parity.test.js`) et `node tools/simulate.js` ne changent pas (§ 9).
2. **Rien ne se perd, jamais d'effet négatif.** Une espèce venue ne repart jamais ; une variété fixée le reste ; les
   graines ne se périment pas ; un aménagement ne se détruit pas ; aucune échéance ; aucun service ne se retourne contre
   le joueur.
3. **Aucune monnaie nouvelle.** Pièces et écus seulement. Les **graines** sont des semences (comme les sachets rares du
   lot 3 et la réserve de la foire du lot 4) : elles se sèment, elles ne s'échangent contre rien.
4. **Le joueur au centre** (« aider sans remplacer »). Les gestes de la Vallée sont les siens. L'équipe et les machines
   ne sèment une variété qu'une fois **fixée**, et leur récolte ne garde **jamais** de graines.
5. **Téléphone portrait d'abord.** Emplacements prédéfinis (pas de placement libre), cibles ≥ 48 px, textes ≥ 14 px, une
   seule fiche « La Vallée », **un seul indice à la fois**, traits en pictogramme **et** en mot (jamais la couleur seule).
6. **Pas de peur de rater.** Une bête venue attend qu'on la voie, un bocal attend qu'on l'ouvre, une cueillette attend la
   fin de la saison, le sachet de la foire revient chaque année.
7. **Équilibre.** L'argent dépensé l'est surtout « pour la beauté et la vie » ; le V1 ajoute **+ 1 à + 5 %** au revenu du
   joueur tranquille, toute la Vallée **≤ + 8 %** ; rythme des rangs inchangé à un an près ; une ferme laissée seule n'en
   profite presque pas (§ 12).
8. **Pur et déterministe.** Un seul flux aléatoire nouveau, `valley` ; aucun flux existant ne tire un nombre de plus.

---

## 1. La boucle de jeu

| Échelle | Ce que fait le joueur (de ses mains) |
|---|---|
| Quelques secondes | Toucher une bête venue pour l'**observer** (elle s'installe) ; **ouvrir un bocal** (la variété se révèle) ; semer une **planche d'essai** ; **récolter à la main** une variété ancienne (+ 2 graines) ; cueillir des mûres dans une haie. |
| Une journée | Lire **le prochain indice** ; poser un aménagement (une haie, un nichoir) ; choisir où semer ses graines anciennes ; laisser une parcelle en **jachère fleurie**. |
| Une saison | **Fixer** une variété (6 récoltes à la main) ; faire venir une espèce ; une étape de la vallée de temps en temps. |
| Une année | La **foire aux graines** (un sachet ancien), le **geai** qui « oublie » un bocal, le bilan « La vallée cette année », de nouveaux aménagements avec le rang. |
| Plusieurs années | V1 complet (12 variétés, 12 habitants, étape 5 « La vallée chante ») vers l'an 9 à 11 pour le joueur tranquille ; (V2) croisements et Grainothèque, (V3) lieux de la vallée et terres sauvages, (V4) cigognes et légendes jusqu'à l'an 16 à 20. |

Session type (5 à 10 minutes, rang 3) : « Le matin, une plume bleue au pied du chêne (indice du geai). Je récolte le champ
de départ à la main : la tomate Cœur de bœuf passe à 5 / 6 et me rend 2 graines. Je pose une bande fleurie avec l'argent de
la saison (les coccinelles n'attendaient que ça). Le lendemain, le hérisson est là, près du tas de bois : je le touche, il
s'installe. »

L'équipe et les machines font la production ; **le joueur fait le vivant**.

---

## 2. Le récit : Joseph et la boîte en fer

### 2.1 Le début (rang 2)

À la **première aube où la ferme est au rang 2** (ou à la première aube d'une carrière déjà au rang 2 ou plus, à la
reprise), Joseph passe avec la boîte en fer. Fenêtre « **La boîte en fer** » (vignette `story.box` : Joseph ouvre une
boîte à biscuits cabossée), trois lignes, puis la révélation de trois variétés (3 graines chacune) :

> « La voilà, la boîte en fer de ma mère. »
> « Un navet, une tomate, une courge de son village : ça germe encore, tu verras. »
> « Le melon, lui, dort trop profond. Peut-être qu'un jour… »

- Graines : **Navet Boule d'or** (se sème tout de suite au printemps et à l'automne), **Tomate Cœur de bœuf**, **Citrouille
  rouge vif d'Étampes** (été).
- Joseph plante **la première haie, offerte**, sur le côté gauche du champ de départ (« Une haie, c'est la maison de tout
  le monde. »).
- La boîte se pose sur le perron (`valley.box`) : la toucher ouvre la fiche « La Vallée ».
- Les **bocaux de graines anciennes** déjà trouvés (défrichage, lot 2 ; Basile, lot 3) apparaissent « à ouvrir ».
- Le melon de la mère de Joseph est une promesse : il germera au lot V4 (§ 18.2 : « quand l'eau revient, tout revient »).

### 2.2 Les chapitres de la vallée

À chaque étape de la vallée (§ 6), Joseph raconte (fenêtre comme la veillée : vignette, trois lignes, « Merci, Joseph »).
Les chapitres sont propres à la carrière (pas la progression partagée des veillées) ; ils **attendent** qu'on les lise
(ligne « À faire » : « Joseph a quelque chose à vous dire »).

| Étape | Titre | Trois lignes |
|---|---|---|
| 1 | Ça chante | « Tu entends ? Ça chante, ce matin. » · « Des années qu'on n'entendait plus rien, par ici. » · « Ils reviennent toujours là où on leur laisse un coin. » |
| 2 | Les haies refleurissent | « Les haies refleurissent, regarde : de l'aubépine, du sureau. » · « À la fin de l'été, il y aura des mûres. Ma mère en faisait des confitures. » · « Laisse-en un peu aux oiseaux, hein. » |
| 3 | Le bourdonnement | « Ça bourdonne de partout. » · « Les abeilles, les bourdons, les papillons : ils font tout le travail, sans salaire. » · « Tes récoltes n'ont jamais été aussi belles. » |
| 4 | Les traces dans la rosée | « Je suis passé par le chemin creux, ce matin. » · « Des traces partout dans la rosée : lièvre, hérisson, renard. » · « La vallée se réveille, petit. Pour de bon. » |
| 5 | La vallée chante | « Écoute. » · « Les oiseaux, les grenouilles, le vent dans les haies… » · « Je te l'avais dit : il suffisait de lui laisser un peu de place. » |

(Le chapitre 5 répond à la 12ᵉ veillée, « La vallée qui chante ». V3 et V4 ajoutent les chapitres 6 à 8, § 11.)

### 2.3 Les petits récits

- **Étiquettes des bocaux** : chaque bocal porte une étiquette à demi effacée qui se complète à l'ouverture (« …une du
  Doubs, 1952 » → « Carotte jaune du Doubs »).
- **Anecdotes** : une phrase par variété et par espèce (≤ 110 caractères), lue dans la fiche et dans l'album.
- **Indices des bêtes** : la veille de sa venue, une trace, un bruit, une plume (« Un hululement, le soir, du côté du
  grenier… »).
- **Bilan de l'année** : un bloc « La vallée cette année » (« 3 habitants sont venus, 2 variétés sauvées, 7 haies
  plantées »).

---

## 3. La grainothèque vivante (V1)

### 3.1 Principe

Une **variété ancienne** est une variante d'une culture existante (même saisons, même durée, même prix de vente de base,
même gel sauf trait) avec **un trait**. On ne l'achète pas : on la **retrouve** (bocal), on la **multiplie** (chaque
récolte **à la main** rend des graines) et on la **fixe** (après 6 récoltes à la main, la variété « tient » : ses graines
deviennent illimitées, on peut la confier à l'équipe).

### 3.2 Les douze variétés du pays

| id | Variété | Culture | Trait | Étiquette du bocal | Anecdote |
|---|---|---|---|---|---|
| `jauneDuDoubs` | Carotte jaune du Doubs (†) | carotte | Savoureuse | « …une du Doubs, 1952 » | Avant la carotte orange, on en cultivait des jaunes, des blanches et des violettes. |
| `bouleDOr` | Navet Boule d'or (†) | navet | Précoce | (boîte de Joseph) | Sa chair jaune est plus douce que celle des navets blancs. |
| `rougeDeBordeaux` | Blé rouge de Bordeaux (†) | blé | Sobre | « …ge de Bord… » | Ses racines vont chercher l'eau très bas : il tient les étés secs. |
| `milanDePontoise` | Chou de Milan de Pontoise (†) | chou | Généreuse | « Milan… Pont… » | Ses feuilles cloquées retiennent la rosée comme de petites cuillères. |
| `coeurDeBoeuf` | Tomate Cœur de bœuf (†) | tomate | Généreuse | (boîte de Joseph) | Une seule peut peser plus d'une livre : une tranche suffit pour une tartine. |
| `grandRouxBasque` | Maïs grand roux basque (†) | maïs | Rustique | « …roux bas… » | On le faisait sécher en tresses sous les toits, pour l'hiver. |
| `soleilDOr` | Tournesol Soleil d'or | tournesol | Mellifère | « Soleil d'… » | Une seule fleur nourrit des centaines d'abeilles en une journée. |
| `vitelotte` | Vitelotte (†) | pomme de terre | Savoureuse | « Vitel… » | Violette dedans comme dehors : la purée en devient mauve. |
| `reineDesVallees` | Fraise Reine des Vallées (†) | fraise | Mellifère | « Reine des V… » | Une fraise des bois sans stolons : elle reste sagement là où on la plante. |
| `rondeDeNice` | Courgette ronde de Nice (†) | courgette | Précoce | « …de de Ni… » | Ronde comme une balle : on la farcit entière. |
| `rougeVifDEtampes` | Citrouille rouge vif d'Étampes (†) | citrouille | Géante | (boîte de Joseph) | C'est la citrouille des contes : aplatie, côtelée, rouge comme un carrosse. |
| `calvilleBlanc` | Pomme Calville blanc d'hiver (†) | pommier | Savoureuse | (greffon de la foire) | Côtelée comme un fruit sculpté : on la servait à la table des rois. |

Rendu : chaque variété a son **icône** et son dessin **mûr** (couleur propre : carotte jaune, pomme de terre violette,
citrouille rouge vif…) ; les étapes 0 à 2 sont celles de la culture. Les champs cessent d'être d'une seule couleur.

### 3.3 Les traits (sept, en pictogramme et en mot)

| id | Trait | Picto | Effet |
|---|---|---|---|
| `early` | Précoce | petite horloge | pousse **+ 15 %** |
| `dry` | Sobre | goutte barrée | un jour sans arrosage compte comme arrosé (pousse 1 ; canicule : 0,75) |
| `hardy` | Rustique | flocon | passe le gel du 1ᵉʳ jour d'hiver ; en hiver (hors serre), pousse × 0,5 ; vendue en hiver : cours « hors saison » × 1,25 |
| `fine` | Généreuse | étoile | chance « belle » **+ 4 points** ; à la main, « dorée » **+ 1 point** |
| `tasty` | Savoureuse | cœur | **+ 10 %** à la vente |
| `bee` | Mellifère | abeille | en pousse, compte comme un **coin fleuri** pour la faune ; avec 2 parcelles mellifères en pousse ou plus, chaque ruche rapporte **+ 1 pièce par jour** (hors hiver) |
| `giant` | Géante | losange | chance de **légume géant × 2** pour un carré 2 × 2 de cette variété |

Les traits restent modestes et liés à une seule culture : aucun ne rend une culture dominante (précoce ne porte que sur
le navet et la courgette, les moins chères ; § 12.3 le vérifie).

### 3.4 Graines, planches d'essai, fixation

| Règle | Valeur |
|---|---|
| Un bocal ouvert | **3 graines** de sa variété |
| Boîte de Joseph | 3 variétés × 3 graines |
| Semer une graine ancienne (avant fixation) | consomme 1 graine, **gratuit** ; parcelle de champ ou de serre (pommier : parcelle de verger) ; saisons de la culture (serre : toutes) |
| Récolte **à la main** d'une variété | la récolte est vendue normalement (trait compris) **+ 2 graines** de la variété, et **+ 1** vers la fixation |
| Récolte par l'équipe ou une machine | vendue normalement (trait compris), **sans graine** et sans compter pour la fixation (F1 : elles n'y touchent qu'après 3 à 4 aubes d'attente) |
| **Fixée** | après **6 récoltes à la main** (cumulées, de n'importe quelle parcelle) ; message « La tomate Cœur de bœuf est sauvée ! » — *réglé à **7** (§ 12.7)* |
| Après fixation | graines **illimitées** au prix de la graine de la culture **× 1,25** (les graines déjà gardées restent gratuites ; la récolte à la main n'en rend plus) ; la variété entre dans le plan de culture et la feuille des graines ; l'équipe et le semoir peuvent la semer |
| Pommier Calville | un « greffon » (jeune plant) au lieu de graines : **+ 1 greffon** par panier cueilli à la main ; fixé après **6 paniers** |
| Légume géant d'une variété, récolté à la main | chaque parcelle compte comme une récolte à la main (+ 2 graines, + 1 vers la fixation) |
| Variété ancienne et grenier | une récolte de variété ancienne **ne va jamais au grenier** (elle est vendue tout de suite, ou part à l'atelier, à une commande, à la quête) : son trait ne se perd pas dans le stock |

**Planche d'essai** = parcelle semée d'une variété pas encore fixée : petite étiquette en bois sur la parcelle
(`valley.label`) ; l'équipe ne la récolte qu'après l'attente F1 ; la fiche dit « À la main : + 2 graines (4 / 6) ».

Rythme visé : 3 graines → 3 récoltes à la main (3 / 6, 6 graines) → 6 parcelles → fixée. **Une saison** environ par
variété une fois le bocal ouvert ; le vrai rythme est celui des **sources** (§ 3.5).

### 3.5 D'où viennent les variétés

| Source | Quand | Ce qu'on reçoit |
|---|---|---|
| La boîte de Joseph | rang 2 (§ 2.1) | 3 variétés (navet, tomate, citrouille) |
| **Bocaux déjà trouvés** (lot 2 et lot 3, `state.career.heirlooms`) | au début de la Vallée | un bocal à ouvrir chacun |
| Bocal au défrichage (lot 2, poids 3 sur 15, 2 trouvailles dans 40 % des cas) | achat d'un terrain | un bocal à ouvrir (≈ 1 terrain sur 4) |
| Bocal de Basile (lot 3, 120) | jour du colporteur | un bocal à ouvrir |
| **Foire aux graines** (lot 4, dernier jour d'hiver) : nouvel étal « La grainothèque du pays » | une fois par an | un sachet de 3 graines d'une variété **pas encore obtenue** (le pommier Calville seulement s'il y a un verger), **60 + 30 × rang** pièces |
| **Le geai des chênes** (habitant, § 4.4) | 1ᵉʳ jour de chaque automne | un bocal « oublié » à ouvrir |

**Ouvrir un bocal** (geste du joueur, fiche « La Vallée » ou ligne « À faire ») : la variété est celle de la culture du
bocal si on ne l'a pas encore ; sinon une variété **pas encore obtenue** (de saison d'abord) tirée sur le flux `valley` ;
si toutes sont obtenues, 3 graines de la variété du bocal. Le bocal s'ouvre avec un petit « pop » et l'étiquette se
complète. Avec ces sources, le joueur tranquille obtient les 12 variétés vers l'an 6 ou 7 (§ 12).

### 3.6 Semer, plan de culture, feuille des graines

- **Feuille des graines** : section « **Graines anciennes** » en tête quand on en a : icône, nom, trait (picto + mot),
  « 5 graines · gratuit » ou « Fixée · 19 » ; « Semer partout » utilise le stock jusqu'au bout (puis s'arrête, avant
  fixation) ; badge « Planche d'essai : récoltez-la à la main ».
- **Plan de culture** (fiche du terrain) : une variété **fixée** se choisit comme une culture ; « Même culture » replante la
  même variété si elle est fixée (sinon la culture ordinaire).
- **Jamais** semée par l'équipe ou le semoir avant fixation ; jamais demandée par le tableau ni la charrette (le
  générateur « faisable cette saison » ne connaît que les cultures). Une récolte de variété compte comme une récolte de sa
  culture pour les commandes, la charrette, les quêtes, le comice, les défis et l'album du potager.

---

## 4. La vallée qui revient (V1)

### 4.1 Les aménagements nature

Posés sur des **emplacements prédéfinis** des terrains possédés (aucun placement libre). Un toucher sur « Aménager »
(fiche « La Vallée » ou section « Nature » de la fiche d'un terrain) met la scène en **mode aménagement** : les
emplacements libres de cet aménagement pulsent ; toucher l'un d'eux → petite feuille « Planter une haie ici ? Le
Haut-Champ, côté gauche · 280 » → « Planter ». Aucun entretien. Aucun ne se retire.

| id | Aménagement | Emplacements | Prix | Rang | Dans la scène |
|---|---|---|---|---|---|
| `hedge` | Haie champêtre | 2 par terrain possédé (côtés gauche et droit : la colonne « forêt ou haie » du bloc), champ de départ et basse-cour compris | **120 + 40 × n**, au plus 600 (n = haies déjà achetées) | 2 | haie basse d'aubépine et de noisetiers : fleurs au printemps, baies à l'automne, nue en hiver |
| `strip` | Bande fleurie | 1 par champ (bas du champ) | **80 + 40 × n** | 2 | coquelicots et bleuets (printemps-été), asters (automne), graines sèches (hiver) |
| `nestbox` | Nichoir | 1 par verger, pré, basse-cour ; 1 dans la bande de la maison | **40 + 20 × n** | 2 | petit nichoir de bois sur un poteau ou un arbre |
| `woodpile` | Tas de bois et de pierres | 1 par pré, verger, basse-cour, friche | **30 + 10 × n** | 2 | bûches moussues et pierres sèches |
| `insectHotel` | Hôtel à insectes | 1 par verger, cour des ateliers ; 1 au champ de départ | **60 + 30 × n** | 2 | petite maison à tiroirs de tiges et de pommes de pin |
| `owlbox` | Nichoir à chouette | 1 : sur le grenier | **150** | 2 (grenier construit) | grande caisse sous le pignon du grenier |
| `loneTree` | Arbre isolé (un chêne) | 1 par pré, friche | **250 + 100 × n** | 3 | jeune plant → jeune arbre (1 saison) → chêne adulte (2 saisons) |
| `reeds` | Berges plantées | 1 : la mare | **300** | 3 (mare) | roseaux et iris sur les bords de la mare |
| `fallow` | Jachère fleurie | une parcelle de champ vide | **gratuit** | 2 | fleurs des champs sur la parcelle, selon la saison |

Tout aménager sur une grande ferme (≈ 38 haies, 6 bandes, 8 nichoirs, 8 tas, 6 hôtels, 6 chênes…) coûte **≈ 27 000
pièces** : un puits moyen, étalé (les prix croissants rendent les premiers aménagements faciles, les derniers sont « pour
la beauté »). **Réaménager un terrain** : les haies restent ; les aménagements intérieurs vont à la **réserve** (« à
replacer », gratuitement, sur un emplacement compatible) ; les habitants restent.

**Jachère fleurie** : toucher une parcelle de champ vide → feuille des graines → « Jachère fleurie (gratuit) ». Elle
fleurit jusqu'au soir du dernier jour de la saison ; à la saison suivante, la parcelle est un **sol reposé** : la
prochaine culture qui y est semée pousse **+ 10 %** (étape 4 : + 20 %) et compte comme « sol reposé » pour la qualité
(lot 2). L'équipe, le semoir et le plan ne sèment jamais sur une jachère ; le joueur peut semer par-dessus (elle s'arrête,
sans sol reposé ; la feuille le dit). C'est le vrai arbitrage agroécologique : une parcelle de moins pendant une saison,
contre des habitants et un sol plus riche.

### 4.2 Les douze habitants de la ferme

Chaque espèce a une **recette d'habitat** lisible, une saison d'arrivée et un **service** doux. Les recettes ne
comptent que des choses **positives** (jamais « pas de machine » ni « moins de… »).

| id | Espèce | Recette d'habitat | Arrive | Service (une fois installée) | Où on la voit |
|---|---|---|---|---|---|
| `robin` | Rouge-gorge | 1 haie + 1 tas de bois | toute l'année | hiver : **4 trouvailles d'hiver** à la fois au lieu de 3 | près du tas de bois |
| `hedgehog` | Hérisson | 2 haies + 1 tas de bois | printemps → automne | récoltes **à la main** : « belle » **+ 1 point** | au pied d'une haie |
| `ladybird` | Coccinelles | 1 bande fleurie + 1 hôtel à insectes | printemps, été | **toutes** les récoltes (équipe comprise) : « belle » **+ 1 point** | sur la bande fleurie |
| `bumblebee` | Bourdons | 2 coins fleuris (bande fleurie, jachère fleurie, variété mellifère en pousse) | printemps → automne | pousse **+ 3 %** (hors hiver) | sur les fleurs |
| `butterfly` | Paon-du-jour | 1 bande fleurie + 1 friche ou jachère + 4 cultures différentes en pousse | été | touristes **+ 15 %** par passage ; beauté + 1 | sur la bande fleurie |
| `swallow` | Hirondelles | 1 abri de grands animaux (étable, écurie, bergerie ou chèvrerie) + la mare | printemps, été | production des abris **+ 5 %** au printemps et en été | autour de l'abri |
| `tawnyOwl` | Chouette hulotte | nichoir à chouette + un arbre adulte (chêne isolé ou pommier) | toute l'année | **corbeaux 2 fois plus rares** | au nichoir du grenier (le soir) |
| `frog` | Grenouille rousse | la mare + 1 haie | printemps, été | jours de pluie : pousse **+ 10 %** | au bord de la mare |
| `dragonfly` | Libellules | la mare + berges plantées | été | pêche : poissons **+ 25 %** | au-dessus des roseaux |
| `hare` | Lièvre | 1 friche ou jachère fleurie + 2 haies | toute l'année | légumes géants : chance **+ 1,5 point** | dans l'herbe haute |
| `squirrel` | Écureuil roux | 1 verger + 2 haies | automne, hiver | trouvailles d'hiver : pièces **× 2** | dans le verger |
| `jay` | Geai des chênes | un chêne isolé adulte + 1 haie | automne | chaque automne, il « oublie » **un bocal de graines anciennes** (§ 3.5) | au pied du chêne |

*Recettes réglées par la simulation (§ 12.7, `src/data/career/valley.js` fait foi)* : bourdons **3** coins fleuris ;
paon-du-jour **2** bandes fleuries (+ friche ou jachère + 4 cultures différentes, verger et variétés anciennes comptant
chacune à part) ; hirondelles + **2 nichoirs** (le nichoir sert enfin à une recette) ; grenouille la mare + **3** haies ;
lièvre friche ou jachère + **4** haies ; écureuil le verger + **5** haies ; geai le chêne adulte + **4** haies. Les autres
recettes sont celles du tableau.

Indices (la veille de la venue) et anecdotes :

| Espèce | Indice | Anecdote |
|---|---|---|
| Rouge-gorge | « Un petit chant clair, très tôt, près du tas de bois… » | Il défend son coin de jardin toute l'année, même en plein hiver. |
| Hérisson | « Des feuilles remuées et de petites traces au pied de la haie… » | Il parcourt jusqu'à deux kilomètres chaque nuit, de jardin en jardin. |
| Coccinelles | « De petits points rouges sur les fleurs de la bande… » | Une coccinelle mange des dizaines de pucerons par jour. |
| Bourdons | « Un gros bourdonnement dans les fleurs… » | Il sort même quand il fait frais : il se réchauffe en faisant vibrer ses ailes. |
| Paon-du-jour | « Des ailes orange, posées au soleil… » | Les quatre « yeux » de ses ailes effraient les oiseaux. |
| Hirondelles | « Des cris aigus au-dessus de l'étable… » | Elles reviennent d'Afrique chaque printemps, souvent dans le même nid. |
| Chouette hulotte | « Un hululement, le soir, du côté du grenier… » | Elle tourne la tête aux trois quarts : ses yeux, eux, ne bougent pas. |
| Grenouille rousse | « Des œufs en grappe dans l'eau de la mare… » | Elle passe l'hiver au fond de la mare, sous la vase. |
| Libellules | « Un éclair bleu au-dessus des roseaux… » | Elle chasse en plein vol et rate rarement sa proie. |
| Lièvre | « De longues traces dans l'herbe haute… » | Un lièvre court à plus de soixante kilomètres à l'heure, en zigzag. |
| Écureuil roux | « Des noisettes rongées au pied des pommiers… » | Il enterre des centaines de noisettes, en oublie beaucoup : des arbres poussent. |
| Geai des chênes | « Un cri rauque, et une plume bleue au pied du chêne… » | Un geai cache des milliers de glands chaque automne : il plante des forêts sans le savoir. |

Le rouge-gorge et le hérisson sont « les premiers habitants » préparés par le lot 4 (mêmes identifiants) : leur fiche le
rappelle (« Vous l'avez déjà vu à la mangeoire »).

### 4.3 Venir, puis s'installer : l'observation

1. **Recette remplie** et saison d'arrivée → à l'aube, **indice** (message du matin, petite trace dessinée à
   l'emplacement : empreintes, plume, coquilles). Une seule nouvelle venue annoncée par aube (la première de la liste).
   *Réglé : 20 % de chances par aube que la bête s'annonce (§ 12.7).*
2. Les aubes suivantes, **50 %** de chances que la bête soit **là** (au plus tard la 3ᵉ aube) : elle se montre à son
   emplacement, avec une petite étincelle « ? », et **reste là jusqu'à ce qu'on vienne la voir** (aucune limite de temps,
   même si la saison change).
3. **La toucher** (cible ≥ 48 px ; ligne « À faire » : « Un hérisson près de la haie du Haut-Champ » → la vue y va) :
   fenêtre « **Le hérisson s'installe !** » (dessin, anecdote, service en une phrase, case d'album) → **installé pour
   toujours**, son service commence.
4. Ensuite, on le croise de temps en temps dans la ferme en saison (décor vivant, sans rien à faire).

L'observation est **le** geste du joueur : sans elle, une bête attend (rien ne se perd) mais ne s'installe pas ; aucune
machine, aucun employé ne le fait. Une recette n'est jamais « perdue » (les aménagements ne disparaissent pas).

### 4.4 La cueillette des haies (étape 2)

À partir de l'étape 2, en **été et en automne**, une **trouvaille** apparaît sur une haie à l'aube (50 %, 3 au plus à la
fois), comme la cueillette d'hiver du lot 4 : toucher = ramasser. Seul le joueur cueille.

| Trouvaille | Saisons | Pièces (× f = 1 + 0,5 × (rang − 1), comme les fêtes) |
|---|---|---|
| Mûres | été, automne | 3 |
| Fleurs de sureau | été | 2 |
| Prunelles | automne | 3 |
| Noisettes | automne | 4 |

---

## 5. Les signes de vie

Un **signe de vie** = une espèce installée ou une variété fixée (V3 : + chaque étape d'un lieu de la vallée et chaque
terre sauvage reprise ; 99 en tout, § 17.9). Le compte n'est **pas** un score affiché en gros : la fiche montre une rangée de silhouettes (grises tant
qu'elles ne sont pas venues) et « 8 signes de vie · prochaine étape à 11 ». Le V1 en compte **24**.

---

## 6. Les étapes de la vallée

Une étape ne se perd jamais. Chacune change ce qu'on voit et entend autour de la ferme, et rend quelque chose de réel.

| Étape | Nom | Signes de vie | Ce qui change autour de la ferme | Ce que la vallée vous rend |
|---|---|---|---|---|
| 0 | La vallée endormie | 0 | lisière sombre, ciel vide, peu d'oiseaux | — |
| 1 | Le premier chant | 2 | quelques oiseaux traversent le ciel ; le chant du matin (ambiance) | 5 écus ; chapitre 1 |
| 2 | Les haies refleurissent | 6 | fleurs sur la lisière de la forêt au printemps | **cueillette des haies** (§ 4.4) ; 10 écus |
| 3 | Le bourdonnement | 11 | papillons dans la scène en été, plus d'oiseaux | **pollinisation** : toutes les récoltes, « belle » **+ 1 point** ; 15 écus |
| 4 | La vallée s'éveille | 17 | lisière fleurie toute la belle saison, traces dans la rosée | **sol vivant** : jachère → + 20 % (au lieu de + 10 %) ; 20 écus |
| 5 | La vallée chante | 24 | lisière vivante, vols d'oiseaux, chants le soir | décor « **Le tilleul de la vallée** » (grand, 2 × 2), 50 écus ; ambiance « la vallée qui chante » |
| 6 *(V3)* | L'eau revient | ruisseau à l'étape 2 + ~~30~~ **56** signes (§ 17.9) | le ruisseau dans la vue de la vallée ; brume du matin | § 17.9 |
| 7 *(V3)* | La vallée vivante | les 6 lieux à l'étape 2 + ~~45~~ **76** signes (§ 17.9) | forêt de la carte plus claire, clairières | § 17.9 |
| 8 *(V4)* | Les cigognes | les cigognes vues sur le clocher (§ 18.4) | cigognes sur le clocher, puis un nid sur la maison ; forêt de la carte qui vieillit | 100 écus, le nid, le chapitre 8, les pois du jour des cigognes (§ 18) |

L'en-tête de la fiche « La Vallée » montre une **vignette de la vallée** (96 × 48, une par étape) : la même vallée,
qui reverdit d'étape en étape.

---

## 7. Récompenses (récapitulatif)

**Avantages réels pour la ferme** (tous modestes, cumulés et plafonnés par l'équilibrage, § 12) :

| Avantage | Source |
|---|---|
| Récoltes plus souvent belles (+ 1 à + 3 points, + 4 sur les variétés généreuses) | hérisson, coccinelles, étape 3, trait généreuse |
| Pousse + 3 % (hors hiver), + 10 % les jours de pluie, + 15 % (précoce), + 10 / 20 % après une jachère | bourdons, grenouilles, trait précoce, jachère |
| + 10 % à la vente (savoureuse), maïs qui passe l'hiver (rustique), blé qui se passe d'eau (sobre) | traits |
| Ruches + 1 pièce par jour (mellifère) ; abris + 5 % (hirondelles) ; poissons + 25 % (libellules) ; touristes + 15 % (paon-du-jour) | traits et habitants |
| Corbeaux 2 fois plus rares (chouette) ; géants + 1,5 point (lièvre), × 2 (citrouille géante) | habitants, trait |
| Hiver : une trouvaille de plus, pièces × 2 | rouge-gorge, écureuil |
| Cueillette des haies ; un bocal par automne | étape 2, geai |

**Cosmétiques et collection** : 2 pages d'album (24 cases), 3 décors « trouvés », 7 succès de carrière (155 écus),
100 écus d'étapes, chants et paysage qui changent.

| Album (pages réservées par le lot 4) | Cases | Condition | Récompense |
|---|---|---|---|
| `heirlooms` « Graines anciennes » | 12 | variété fixée | 30 écus + décor « Le semainier à graines » (`seed.cabinet`) |
| `wildlife` « Les habitants de la ferme » | 12 | espèce installée (observée) | 30 écus + décor « Le nichoir peint » (`nestbox.painted`) |

| Succès (catégorie « Carrière », écus seulement) | Condition | Écus |
|---|---|---|
| `valleyBox` La boîte en fer | recevoir la boîte de Joseph | 10 |
| `firstSaved` Graine sauvée | fixer une première variété | 10 |
| `seedKeeper` Gardien des semences | fixer les 12 variétés du pays | 40 |
| `firstNeighbour` Premier habitant | installer une première espèce | 10 |
| `welcomingFarm` La ferme accueillante | installer les 12 habitants | 40 |
| `valleySings` La vallée chante | atteindre l'étape 5 | 30 |
| `seedHands` Les mains dans les graines | 100 récoltes à la main de variétés anciennes | 15 |

---

## 8. Intégration avec l'existant (sans doublon)

| Existant | Ce que la Vallée en fait | Pourquoi pas un doublon |
|---|---|---|
| **Rangs** | La Vallée commence au rang 2 ; certains aménagements attendent un rang (chêne et berges : rang 3). **Aucun objectif de rang** ne dépend de la Vallée. Les aménagements apparaissent dans les déblocages de rang (`unlocks`). | Les rangs mesurent la ferme ; la Vallée a ses propres étapes, sans jamais freiner un rang. |
| **Patrimoine** | Les dépenses de la Vallée comptent **à 100 %** dans le patrimoine (« une terre vivante vaut ce qu'on y a mis ») : dépenser pour la vallée ne retarde aucun rang. *(À trancher, § 15.)* | — |
| **Joseph** | La boîte en fer, la première haie, les chapitres. Ses quêtes, ses cœurs, son prêt : inchangés (V2 : une quête « variété ancienne » par an au plus). | Les quêtes restent un fil d'amitié ; la Vallée est un récit d'étapes. |
| **Veillées** (lot 4) | Inchangées (progression partagée). Elles **annoncent** la Vallée (boîte en fer, haies, ruisseau, cigognes) ; le chapitre 5 leur répond. | Les chapitres sont propres à la carrière. |
| **Bocaux de graines anciennes** (lots 2 et 3) | Deviennent des bocaux à ouvrir (les anciens d'abord). | C'était leur promesse (« gardé pour la Vallée »). |
| **Tableau du village, charrette, défis** (lot 3) | Une récolte de variété compte pour sa culture. Le générateur ne demande jamais une variété. | Pas de deuxième système de commandes. |
| **Colporteur** (lot 3) | Le bocal de Basile donne un bocal à ouvrir. | — |
| **Années à thème** (lot 3) | Inchangées en V1 (V3 : « L'année de la vallée »). | — |
| **Fêtes** (lot 4) | Foire aux graines : nouvel étal « La grainothèque du pays » (un sachet ancien par an). Stand de la ferme (V2) : + 1 point par variété ancienne. | La foire existe déjà : un étal de plus, pas une fête de plus. |
| **Hiver vivant** (lot 4) | Rouge-gorge et écureuil améliorent la cueillette d'hiver ; la mangeoire et ses oiseaux ne changent pas. | — |
| **Lanternes** (lot 4) | Critère **Beauté** (carrière) : + 1 point par aménagement nature, **6 au plus** ; paliers recalibrés par la simulation. | Pas de 6ᵉ critère : la beauté était prévue pour ça (§ 17.9 du game design). |
| **Album** (lot 4) | Remplit les deux pages réservées `heirlooms` et `wildlife` ; les lots suivants ajoutent des **pages nouvelles** (jamais de case ajoutée à une page existante). | — |
| **F1 « aider sans remplacer »** | Les gestes de la Vallée sont ceux du joueur ; l'équipe sème une variété fixée, ne garde jamais de graines. | La Vallée prolonge F1 : ce que les machines ne font jamais. |
| **Mare, verger, pré, cour, friche, grenier** | Supports d'aménagements et de recettes (la friche devient un habitat : terrain acheté laissé sauvage). | Rien de nouveau à construire pour commencer. |
| **Corbeaux, pêche, touristes, ruches, géants, qualité** | Leviers existants des services (aucune mécanique nouvelle pour les services). | — |

---

## 9. Les niveaux : rien ne change

La Vallée est **propre à la carrière** : une année de niveau est une contrainte indépendante, sans lendemain ; faire
revivre une vallée demande des années. **Aucune règle, aucun flux aléatoire, aucun champ d'état** n'est ajouté aux parties
de niveau (Détente comme Classique) : parité et simulateur des niveaux identiques.

La seule trace côté niveaux est **l'affichage** : les deux nouvelles pages de l'album (progression permanente) se voient
dans la grange, avec l'indice « À découvrir dans Ma ferme », exactement comme les cases « C » du lot 4. Idée écartée :
offrir une variété ancienne en récompense d'un niveau (lierait les deux modes et casserait la parité de la Détente).

---

## 10. Écrans du téléphone (portrait, 412 × 915 et 360 × 740)

### 10.1 La fiche « La Vallée » (feuille haute, pause pendant la lecture)

Ouverte par : la **boîte en fer** du perron (scène), la carte « La Vallée » en tête du Carnet › Ferme, la ligne « À
faire », le menu de partie. (Le Carnet a déjà 5 onglets : pas de 6ᵉ.)

```
┌──────────────────────────────────────┐
│ La Vallée                         ✕  │  ruban de titre
│ ┌──────────────────────────────────┐ │
│ │  [vignette de la vallée 96 × 48, │ │  agrandie × 3, pixel net
│ │   étape 2 : haies en fleurs]     │ │
│ └──────────────────────────────────┘ │
│ Étape 2 · Les haies refleurissent    │  16 px
│ ●●●●●●●●○○○ 8 signes de vie · étape 3 à 11 │  14 px, lu « 8 sur 11 »
│ ┌ Le prochain indice ──────────────┐ │  carte ≥ 72 px
│ │ [hérisson gris] Le hérisson aime  │ │
│ │ les tas de bois : il en manque 1. │ │
│ │                    [ Aménager ]   │ │  ≥ 48 px
│ └──────────────────────────────────┘ │
│ [ Graines ][ Habitants ][ Aménager ] │  segments ≥ 48 px
│  … contenu de l'onglet …             │  défilement interne
└──────────────────────────────────────┘
```

- **Le prochain indice** (toujours un seul) : (1) une bête à aller voir ; (2) un bocal à ouvrir ; (3) une planche d'essai
  mûre ; (4) l'espèce la plus proche de venir (ce qui manque, avec « Aménager ») ; (5) des graines qui attendent d'être
  semées ; (6) l'étape suivante.
- **Graines** : en tête « 2 bocaux à ouvrir » (bouton). Puis une ligne par variété (≥ 72 px) : icône 48 px, nom, trait
  (picto + mot), état — silhouette « À retrouver : un bocal au défrichage, chez Basile, à la foire » · « 3 graines · 4 / 6
  récoltes à la main » (barre lue) · « Sauvée ✓ · dans le plan de culture ». Toucher → fiche du bas : grand dessin, anecdote,
  trait expliqué, « Semer : touchez une parcelle vide ».
- **Habitants** : une ligne par espèce : silhouette grise ou dessin, nom, recette en lignes cochées (« ✓ 2 haies » · « ✗ 1
  tas de bois » · « ✓ printemps → automne »), état « Indice : des traces… », « Il vous attend près de la haie du Haut-Champ
  [Aller voir] », « Installé ✓ — les récoltes à la main sont plus souvent belles ».
- **Aménager** : une carte par aménagement (icône, nom, prix, « 5 emplacements libres », effet en une ligne, verrou « Rang
  3 ») → « Choisir un emplacement » (mode aménagement).

### 10.2 Le mode aménagement (scène)

La barre d'onglets est remplacée par une barre « 🌿 Haie champêtre · 280 · Touchez un emplacement · [Terminer] » (comme
le mode décoration) ; les emplacements libres pulsent (contour pointillé, ≥ 48 px) ; toucher → petite feuille de
confirmation (« Le Haut-Champ, côté droit · 280 · [Planter] ») ; la haie pousse sous les yeux (fondu, mouvements réduits
respectés). On peut faire défiler la ferme en 2D et la zoomer (pincer, boutons + / −) pendant le mode ; la mini-carte marque les
terrains qui ont des emplacements libres.

### 10.3 Observer une bête

Une bête **venue** se dessine à son emplacement avec une petite étincelle et un « ? » discret (mouvements réduits :
immobile). Toucher → fenêtre popup (≤ 50 % de l'écran, la bête reste visible au-dessus) :

```
┌──────────────────────────────────────┐
│        [hérisson 64 px]              │
│   Le hérisson s'installe !           │
│ Il parcourt deux kilomètres chaque   │
│ nuit, de jardin en jardin.           │
│ ♥ Vos récoltes à la main seront plus │
│   souvent belles (+ 1 point).        │
│ ✓ Album : Les habitants de la ferme  │
│ [   Bienvenue, petit hérisson !   ]  │  ≥ 56 px
└──────────────────────────────────────┘
```

### 10.4 Ouvrir un bocal

Popup : un bocal de verre à l'étiquette à demi effacée (« …une du Doubs, 1952 ») ; « Ouvrir » → le couvercle saute, trois
graines tombent, l'étiquette se complète : « **Carotte jaune du Doubs** · Savoureuse : + 10 % à la vente · 3 graines »
→ « Semer » (ferme la fenêtre et montre les parcelles vides du champ le plus proche) ou « Plus tard ».

### 10.5 Fiches existantes enrichies

- **Fiche d'une parcelle** : « Tomate Cœur de bœuf · variété ancienne (planche d'essai) · Généreuse · À la main : + 2
  graines (4 / 6) » ; jachère : « Jachère fleurie jusqu'à la fin de l'été · ensuite : sol reposé (+ 10 % de pousse) ».
- **Fiche d'un terrain** : section « Nature » : « Haie, côté gauche ✓ · Haie, côté droit [Planter · 280] · Bande fleurie
  [Semer · 120] ».
- **Ligne « À faire »** : « Un hérisson vous attend près de la haie » · « 2 bocaux à ouvrir » · « Joseph a quelque chose à
  vous dire ». **Résumé du matin** : « Des traces près du tas de bois… », « Hier : 3 graines anciennes gardées ».
- **Bilan de l'année** : bloc « La vallée cette année » (habitants venus, variétés sauvées, aménagements, étape).
- **Conseils « première fois »** : `valley.box`, `valley.jar`, `valley.trial` (première planche d'essai mûre),
  `valley.nature` (premier aménagement), `valley.species` (première bête venue), `valley.fixed`, `valley.fallow`,
  `valley.stage`.

Accessibilité : cases ≥ 48 px, textes ≥ 14 px (12 px pour les mentions), états lus par les lecteurs d'écran (« 4 récoltes
sur 6 », « installé »), silhouettes doublées d'un nom, traits en mot, pause pendant la lecture, mouvements réduits partout.

---

## 11. Découpage en lots

Chaque lot est jouable et livrable seul, du plus structurant au plus décoratif. Les sauvegardes passent d'un lot au
suivant sans perte (§ 13).

### 11.1 V1 — « La boîte en fer » (graines et premiers habitants) — **structurant**

Contenu : tout ce qui précède (§ 2 à § 10) : état et étapes de la Vallée (0 à 5), boîte de Joseph et chapitres,
12 variétés du pays (bocaux, graines, planches d'essai, fixation, 7 traits, plan de culture), 8 aménagements + jachère,
12 habitants (recettes, indices, observation, services), cueillette des haies, étal de la foire, 2 pages d'album,
7 succès, beauté des lanternes, fiche « La Vallée », mode aménagement, scène (aménagements, bêtes, variétés, lisière
selon l'étape), simulation et réglage. Contrats : `docs/ARCHITECTURE.md`.

Pourquoi d'abord : il pose **tous** les systèmes dont les lots suivants dépendent (état, variétés et traits dans le
cœur, emplacements, recettes, observation, signes de vie, étapes, fiche), il tient la promesse des bocaux déjà gardés et
des veillées, et il est déjà « la Vallée vivante » en petit (les deux moitiés et leur lien : fleurs mellifères ↔
bourdons, chêne ↔ geai ↔ bocaux).

Taille : comme le lot 4 (CORE · ART · UI/RENDER en parallèle).

### 11.2 V2 — « Le troc et les croisements » (la grainothèque grandit)

*Aperçu d'origine, gardé pour l'histoire : la **conception détaillée du V2 est au § 16** (2026-10-03) et le remplace là
où ils diffèrent (écarts : § 16.14) ; contrats : `docs/ARCHITECTURE.md`, « Vallée vivante — contrats du lot V2 ».*

- **La Grainothèque** (bâtiment en pierre au tilleul, sur un emplacement libre de pré, de basse-cour ou de cour des
  ateliers), **5 niveaux : 2 000 / 5 000 / 10 000 / 16 000 / 25 000** (rangs 3, 3, 4, 5, 6 ; 58 000 en tout) : N1 troc et
  croisements ; N2 + 1 graine par récolte à la main (3) ; N3 fixation en 5 récoltes ; N4 chance de croisement + 5 points ;
  N5 graines des variétés fixées au prix normal (× 1) et touristes + 15 %.
- **Le troc de graines** : chaque client du tableau garde une variété de son jardin (12 : Lili → Carotte violette, Paulo
  → Blé barbu du Roussillon (†), Chevalier → Tomate noire de Crimée (†), Fabre → Courgette blanche de Virginie (†),
  Odette → Chou cœur de bœuf des Vertus (†), Garnier → Pomme de terre bleue d'Artois, Rose → Tournesol velours rouge,
  Perrin → Fraise Madame Moutot (†), le maire → Maïs blanc des Landes, Morel → Navet long des Vertus (†), les jumeaux →
  Citrouille galeuse d'Eysines (†), Léon → Reinette grise du Canada (†, greffon)). On lui donne 3 graines d'une variété
  fixée qu'il n'a pas, il donne 3 graines de la sienne (une fois par client ; à la foire, puis toute l'année avec la
  Grainothèque N1). Page d'album `swaps` (12).
- **Les croisements** : deux parcelles **voisines** (même champ ou serre, par un côté) de **deux variétés de la même
  culture**, mûres, récoltées **à la main le même jour** → **15 %** de chances d'un **sachet croisé** (1 graine ; + 5 points
  avec les bourdons, + 5 avec les abeilles sauvages, + 5 avec la Grainothèque N4 ; 30 % au plus ; flux `valley`). Table
  fixe en données (rejouable, devinable). **11 variétés croisées** « {Culture} de {nom de la ferme} » (ex. « Tomate de la
  Ferme des Mûriers »), **deux traits** (ceux des parents ; trait en double → un troisième), à fixer comme les autres. Page
  d'album `crosses` (11). C'est « l'héritage qui porte votre nom ».
- Un trait nouveau, **Parfumée** (produit d'atelier + 15 % ; l'atelier garde la variété de la récolte).
- **4 habitants** liés aux graines : abeille sauvage (hôtel + 3 coins fleuris → croisement + 5 points), merle (4 haies →
  cueillette des haies : 4 à la fois), lézard des murailles (2 tas de pierres, été → les jours de canicule, pousse + 10 %),
  pipistrelle (nichoir à chauves-souris, nouvel aménagement, + la mare → équipe joyeuse les soirs d'été). La page `wildlife`
  ne change pas : ils vont dans une page nouvelle, « Les habitants (suite) » (`wildlife2`, 4 cases ; choix du § 15).
- Liens : stand de la ferme + 1 point par variété ancienne ; comice : épreuve « Présenter N variétés anciennes » (N = 2 +
  ⌊rang / 2⌋) ; Joseph : une quête « une variété ancienne » par an au plus.
- Cible : revenu du joueur tranquille + 1 à + 3 % de plus que le V1 ; puits ≈ 58 000.

### 11.3 V3 — « Le ruisseau » (les lieux de la vallée et les terres sauvages) — **le grand puits d'argent**

*Aperçu d'origine, gardé pour l'histoire : la **conception détaillée du V3 est au § 17** (2026-10-03) et le remplace là
où ils diffèrent (écarts : § 17.15 ; puits recalé à ≈ 251 000 pour finir vers l'an 18) ; contrats : `docs/ARCHITECTURE.md`,
« Vallée vivante — contrats du lot V3 ».*

- **La vue de la vallée** : un panorama vertical illustré (canevas plein écran, en portrait, qu'on fait défiler au doigt)
  ouvert depuis la route en bas de la ferme et la fiche « La Vallée » (4ᵉ onglet « Lieux »). La ferme y est un petit carré
  au milieu ; autour, **six lieux**, chacun en 4 états dessinés.
- Chaque **étape d'un lieu** = un **chantier** (pièces) **et** une condition de vie (ce que la ferme apporte) **et** un temps
  de reprise (le lieu change sur une saison, visible). Le chantier paie le travail ; le lieu ne revient que si la ferme lui
  en donne les moyens.

| Lieu | Étapes (chantier · condition) | Ce que le lieu rend | Habitants du lieu |
|---|---|---|---|
| **Le ruisseau** (le Ru des Saules ; 3ᵉ veillée) | à sec → *un filet d'eau* (4 000 · 6 haies : « les haies retiennent l'eau ») → *le ruisseau chante* (8 000 · 2 jachères dans l'année) → *les truites reviennent* (15 000 · bois à l'étape 1) → *le moulin tourne* (25 000 · étang à l'étape 2) | canicule sans arrosage : pousse 0,5 (au lieu de 0,25) ; une 2ᵉ pêche par jour (eau vive) ; écrevisses (3ᵉ veillée) ; moulin à eau : le moulin (atelier) + 1 place | écrevisse, héron cendré, martin-pêcheur, loutre |
| **Le bois de la Combe** | coupe rase → *jeunes plants* (3 000 · geai installé) → *bois clair* (7 000 · 1 an) → *vieille futaie* (14 000 · 2 ans) | bois mort : chauffage de la serre − 50 % ; champignons d'automne (cueillette) | chevreuil, pic noir, salamandre |
| **La prairie des Coquelicots** | friche sèche → *prairie* (2 000 · 3 jachères dans l'année) → *prairie fleurie* (5 000 · bourdons et paon-du-jour) → *prairie aux orchidées* (10 000 · 2 ans) | foin : entretien des animaux − 10 % | alouette des champs, huppe fasciée |
| **L'étang du moulin** | vase → *étang* (6 000 · ruisseau à l'étape 2) → *nénuphars* (12 000 · libellules) → *roselière* (20 000 · 1 an) | touristes + 15 % ; poissons de l'étang | (grenouilles, libellules, héron, martin-pêcheur) |
| **Le bocage du chemin creux** | talus nus → *haies replantées* (2 500 · 12 haies sur la ferme) → *le bocage* (6 000 · hérisson et rouge-gorge) → *les vieux têtards* (12 000 · chouette hulotte + 1 an) | plus aucun corbeau ; cueillette des haies : pièces × 2 | chouette chevêche |
| **Le verger conservatoire** (le vieux verger de la commune) | pommiers abandonnés → *taillés et greffés* (3 000 · Calville fixée) → *en fleurs* (7 000) → *le conservatoire* (14 000 · 1 an) | **arbres anciens** pour vos vergers : Reinette grise du Canada (†), **cerisier Montmorency** (†) et **poirier Louise-Bonne** (†) (cerisier et poirier : les arbres de la phase B, dessinés, enfin plantables) | — |

  Chantiers : **≈ 175 000** pièces en tout. 10 habitants de la vallée (page d'album `valleyWild`), page `places` (6 lieux).
- **Les terres sauvages** (sur la carte de la ferme, **une fois les 16 terrains achetés**) : chaque case de forêt restante
  de la grille peut être « confiée à la nature » : **bois**, **marais** ou **prairie**, **4 000 + 800 × n** (18 cases au plus
  sur une carte 2D : ≈ 194 000). Elle change sur la carte (clairière fleurie, roseaux, jeune bois), compte comme un signe de
  vie et un habitat pour les recettes de la vallée (chevreuil : 2 bois). Elle ne produit rien. Aucun conflit avec l'achat des
  terrains (il n'y en a plus à acheter).
- Étapes 6 (« L'eau revient ») et 7 (« La vallée vivante »), chapitres 6 et 7 ; année à thème « **L'année de la vallée** »
  (vedette : une variété fixée ; visiteuse : Hélène la naturaliste, qui offre un nichoir peint et montre toutes les
  recettes).
- Nouvelles cultures-arbres hors de `CROPS` (liste à part, comme les graines rares, pour ne changer aucun tirage).
- Cible : argent du joueur tranquille à l'an 14 **≤ 50 %** de ce qu'il serait sans la Vallée ; revenu ≤ + 2 % de plus.

### 11.4 V4 — « Les cigognes » (légendes et souvenirs) — **décoratif**

*Aperçu d'origine, gardé pour l'histoire : la **conception détaillée du V4 est au § 18** (2026-10-04) et le remplace là
où ils diffèrent (écarts : § 18.15) ; contrats : `docs/ARCHITECTURE.md`, « Vallée vivante — contrats du lot V4 ».*

- **Légendes** (page `legends`, 4) : le **melon de la mère de Joseph** (il « se réveille » : serre + Grainothèque N5 + 3
  croisements réussis), et trois variétés de 3ᵉ génération (croisée × croisée), au nom de la ferme.
- **Visiteurs rarissimes** (4) : **cigogne blanche** (chantier du clocher, 10 000, quand les six lieux sont à l'étape 2 :
  elle niche sur le clocher — la grand-mère de Joseph, 9ᵉ veillée — puis, l'année suivante, sur le Manoir), grue cendrée
  (un jour d'automne, passage au-dessus de la prairie aux orchidées), cerf (vieille futaie + 4 terres de bois), loriot
  (verger conservatoire + 2 ans). Étape 8 et chapitre 8.
- **Paysage complet** : forêt de la carte en 4 états dessinés, ambiance sonore en couches (oiseaux, grenouilles, ruisseau ;
  sons CC0 listés dans `CREDITS.md`), **avant / après** au bilan annuel (vignette de la vallée l'an 1 à côté de
  l'an N), page « La vallée de … » partageable en image.
- Aucun effet sur le revenu (écus, décors, succès).

---

## 12. Équilibrage

### 12.1 Ce qu'on mesure aujourd'hui (repère, `--trace --seed 3 --strategy casual --years 14`)

Joueur tranquille : Domaine à l'an 8 ; revenu ≈ 24 000 (an 4) → 47 000 (an 10) → 51 000 (an 14) ; bénéfice ≈ + 35 000 à
+ 42 000 par an après l'an 10 ; **argent en caisse 53 000 (an 11) → 165 000 (an 14)**, sans rien à acheter.

### 12.2 Cibles du V1 (Détente, saisons de 7 jours, 60 carrières × 10 ans, `--compare-valley` : sans → avec, même graine)

| Mesure | Cible |
|---|---|
| Tranquille : revenu sur 10 ans | **+ 1 à + 5 %** (services ≈ + 2 %, traits ≈ + 1,5 %, cueillette des haies ≈ + 0,5 %) |
| Tranquille : dépenses de la Vallée sur 10 ans | 8 000 à 20 000 (surtout après le rang 5) |
| Tranquille : rang médian par année · Domaine | identique **à un an près** ; Domaine à l'an 8 (± 1) |
| Tranquille : nouveautés de la Vallée | **≥ 1 par saison** (bocal, graine sauvée, indice, habitant, étape) dans ≥ 80 % des saisons des ans 2 à 10 |
| Tranquille : collection | 6 variétés fixées et 6 habitants à l'an 5 (médiane) ; les 12 + 12 entre l'an 9 et l'an 11 ; étape 5 vers l'an 10 |
| Tranquille : gestes par jour (ans 5 à 10) | + 0,5 à + 2 (observer, ouvrir, semer les planches, poser) ; part des récoltes à la main ≥ 50 % |
| Débutant | rang 3 à l'an 5 dans ≥ 70 % (inchangé) ; ≥ 4 variétés et ≥ 4 habitants à l'an 8 |
| Appliqué (`optimal`) | 12 + 12 vers l'an 6 ou 7 ; revenu ≤ + 6 % |
| Ferme laissée seule (`handsOff`, ans 4 à 7) | bénéfice **≤ + 3 %** (la Vallée n'enrichit pas une ferme sans fermier) |
| `automator` (aucun geste dès l'an 3) | Domaine pas avant l'an 7 (inchangé) ; patrimoine à l'an 10 ≤ + 3 % ; **aucun habitant installé** (il n'observe pas) |
| Lanternes (beauté, carrière) | règle de calibrage du § 17.2.1 du game design (paliers relevés d'autant que les points nature) |
| Carrière Classique, tranquille | faillites ≤ 20 % (inchangé) |
| Niveaux | **identiques** (parité, `node tools/simulate.js`) |

### 12.3 Garde-fous de conception

- **Rareté des graines avant fixation** : la Vallée ne change le champ que lentement (3 graines par bocal).
- **Traits sur des cultures différentes** : précoce sur les deux cultures les moins chères ; savoureuse et généreuse sur
  des cultures moyennes. Mesure dédiée : part de chaque culture dans les semis de l'appliqué (aucune ne doit gagner plus de
  10 points de part par rapport à sans la Vallée).
- **Services plafonnés** : la chance « belle » de la Vallée ne dépasse jamais + 3 points (+ 7 sur une variété généreuse) ;
  la pousse + 3 % s'ajoute aux ruches comme une demi-ruche.
- **L'observation** retire tous les services à une ferme sans fermier (`automator`, `handsOff`).

### 12.4 Robots (par l'API publique, leurs propres tirages)

- **Tranquille** : ouvre un bocal quand il en voit un (un jour sur deux) ; sème ses graines anciennes à la main sur le
  champ de départ (avant « semer partout ») ; pose un aménagement par saison quand l'argent dépasse prix + 2 saisons de
  charges, dans l'ordre : haie, tas de bois, bande fleurie, 2 haies, hôtel à insectes, nichoir, nichoir à chouette,
  berges, chêne ; après le rang 6, aménage tout ce qui est libre ; va voir une bête venue 70 % des jours joués ; une jachère
  au printemps 30 % des années ; sachet de la foire 50 % ; cueille une haie sur deux.
- **Débutant** : 30 % de tout cela, aucun aménagement avant le rang 3.
- **Appliqué** : tout, dès que possible, en visant les signes de vie ; plan de culture avec les variétés fixées.
- `handsOff`, `idle` : rien après leur dernière année jouée. `automator` : achète les aménagements (décisions), mais ne
  fait aucun geste (ni bocal, ni planche, ni observation).

### 12.5 Leviers si une cible n'est pas tenue (dans cet ordre)

Récoltes à la main pour fixer (6 → 5 ou 8) ; graines par récolte (2 → 1 ou 3) ; force des services (points de qualité,
pousse) ; prix des aménagements ; chance de venue (50 %) ; paliers des étapes. **Jamais** les chiffres des niveaux ni le
rythme des rangs.

### 12.6 Cibles d'ensemble (V1 → V4, `--years 20`)

| Mesure (tranquille) | V1 | + V2 | + V3 | + V4 |
|---|---|---|---|---|
| Revenu sur 10 ans | + 1 à + 5 % | ≤ + 6 % | ≤ + 8 % | ≤ + 8 % |
| Puits « pour la beauté » | ≈ 27 000 | + 58 000 (réglé : 62 800) | + 175 000 chantiers + 194 000 terres (conception § 17 : **160 000 + 90 900**) | — |
| Argent en caisse à l'an 14 | ≤ 85 % de sans | ≤ 70 % | ≤ 50 % | ≤ 50 % |
| Tout restauré | — | — | an 16 à 20 (appliqué : an 11 à 14) — décision : **vers l'an 18** (§ 17.12) | idem |

---

### 12.7 Résultats et réglages (livraison CORE V1, 2026-10-03)

Mesures : `node tools/simulate-career.js --compare-valley --runs 60 --years 10` (Détente, saisons de 7 jours, sans → avec,
même graine ; robots du § 12.4 avec leur tirage propre) ; `--years 14 --runs 30` pour la traîne ; `--difficulty
classique` pour les faillites ; `--lanterns` pour la beauté. Le simulateur des niveaux (`node tools/simulate.js`) donne
une sortie **identique octet pour octet** à celle d'avant la Vallée ; parité `node tools/capture-parity.js --check` :
400 / 400.

**Réglages** (dans l'ordre des leviers du § 12.5 ; `src/data/career/valley.js` fait foi) :

| Réglage | Départ | Réglé | Pourquoi |
|---|---|---|---|
| Récoltes à la main pour fixer | 6 | **7** | 12 variétés à l'an 8 → an 9 ; à 8, le débutant n'en avait plus 4 à l'an 8 |
| Graines après fixation | (non dit) | **aucune** | lecture du § 3.4 ; sinon semis gratuits à vie (rareté du § 12.3) |
| Venue : chance qu'une bête s'annonce, recette remplie | 100 % à l'aube | **20 % par aube** | étale les venues (même nombre tiré qu'avant) |
| Recettes tardives | — | bourdons 3 coins fleuris ; paon-du-jour 2 bandes ; hirondelles + 2 nichoirs ; grenouille + 3 haies ; lièvre + 4 haies ; écureuil + 5 haies ; geai + 4 haies | 10 habitants à l'an 5 → 7 ; les derniers viennent avec les aménagements des rangs 5 et 6 |
| « Cultures différentes » (paon-du-jour) | champs et serre | + verger, variété ancienne à part | sinon le paon-du-jour ne venait presque jamais (plans d'une seule culture) |
| Lanternes (carrière) | variété 10 / 14 / 16, beauté 8 / 13 / 15 | **11 / 16 / 18**, **14 / 19 / 21** | règle du § 17.2.1 (beauté + 6 points nature + 1 paon-du-jour ; les graines anciennes font semer plus de cultures) |

Robots (§ 12.4, précisions) : le tranquille pose un aménagement par saison (sa liste, puis dès le rang 5 ce qui est libre ;
deux par saison au rang 6), décide une jachère au printemps et en été (30 % chacun) et la pose dès qu'une parcelle de
champ tenue à la main est vide, plante le greffon du Calville au verger (en arrachant un pommier ordinaire s'il le faut) ;
l'appliqué ne met au plan que les variétés dont le trait paie la graine × 1,25 (savoureuse, précoce, géante, rustique) et
garde 4 saisons de charges avant d'aménager.

**Résultats** (60 carrières × 10 ans, sauf mention) :

| Mesure | Cible | Mesuré |
|---|---|---|
| Tranquille : revenu sur 10 ans | + 1 à + 5 % | **+ 3,0 %** (297 051 → 306 024) ; 14 ans : + 3,5 % |
| Tranquille : dépenses de la Vallée sur 10 ans | 8 000 à 20 000, surtout après le rang 5 | **17 950** (1 870 à l'an 5) ; 24 200 à l'an 14 |
| Tranquille : rangs, Domaine | à un an près ; Domaine an 8 (± 1) | rangs identiques sauf an 7 (5 → 6) ; Domaine **an 8 → 7** |
| Tranquille : collection | 6 + 6 à l'an 5 ; 12 + 12 entre l'an 9 et l'an 11 ; étape 5 vers l'an 10 | **7 + 7** à l'an 5 ; 12 variétés **an 9**, 12 habitants **an 11**, étape 5 **an 11** (14 ans) |
| Tranquille : nouveautés | ≥ 1 par saison dans ≥ 80 % des saisons (ans 2 à 10) | **65 %** (médiane) — *non tenu*, voir ci-dessous |
| Tranquille : gestes par jour (ans 5 à 10) ; part à la main | + 0,5 à + 2 ; ≥ 50 % | **+ 0,3** (8,0 → 8,3) — *un peu bas* ; **92 %** |
| Débutant | rang 3 à l'an 5 ≥ 70 % ; ≥ 4 variétés et ≥ 4 habitants à l'an 8 | **100 %** ; médiane **4 et 4** (55 % et 62 % des carrières) ; revenu + 2,5 % |
| Appliqué | 12 + 12 vers l'an 6 ou 7 ; revenu ≤ + 6 % | 12 variétés an 5, 12 habitants et étape 5 **an 8** ; revenu **+ 0,1 %** |
| Ferme laissée seule (ans 4 à 7) | bénéfice ≤ + 3 % | **− 0,4 %** |
| `automator` | Domaine pas avant l'an 7 ; patrimoine an 10 ≤ + 3 % ; aucun habitant | Domaine jamais (inchangé) ; **+ 0,5 %** ; 3 habitants, tous observés les ans 1 et 2 (il joue encore) — **aucun après l'an 2** |
| Part des semis (appliqué) | aucune culture + 10 points | écart le plus grand **1,3 point** (chou) |
| Carrière Classique, tranquille | faillites ≤ 20 % | **0 %** (30 carrières ; revenu + 3,6 %) |
| Argent en caisse (tranquille) | an 14 ≤ 85 % de sans (cible d'ensemble, § 12.6) | an 10 : 95 % ; an 14 : **97 %** — le V1 seul ne crée pas le puits (V2, V3) |
| Lanternes (tranquille, carrière) | § 17.2.1 ; total médian ≈ 11 | total médian **12 / 20** ; beauté 17 / 33 / 33 / 17 % ; variété 13 / 53 / 25 / 9 % |

**Relance après l'intégration (2026-10-03)** — une planche d'essai perdue sans récolte (gel, pourriture, arbre arraché)
rend maintenant sa graine (« rien ne se perd ») : `--compare-valley --runs 60` donne tranquille **+ 3,2 %** de revenu
(306 439 ; 8 variétés et 7 habitants à l'an 5, 12 variétés an 9), dépenses 18 063, Domaine an 8 → 7 ; débutant + 2,2 %
(4 + 4 à l'an 8 dans 57 % / 58 %) ; appliqué + 0,1 % ; ferme laissée seule **− 0,9 %** ; `automator` + 0,3 % de patrimoine ;
part des semis : écart le plus grand 1,1 point. Toutes les cibles restent tenues (sauf « nouveautés », 65 %, comme
avant). Parité des niveaux 400 / 400.

**Nouveautés : pourquoi 65 % et pas 80 %.** Toutes les saisons d'automne ont leur nouveauté dès l'arrivée du geai (son
bocal), les ans 2 à 5 en ont ≥ 75 % ; le creux est aux ans 6 et 7 (rang 5, plus rien de la liste à poser, les dernières
recettes attendent des haies) et aux printemps et hivers des ans 8 à 10 (tout ce qui vient au printemps est déjà là).
Étaler davantage demanderait des venues bien plus lentes, au détriment du débutant (déjà juste à 4 + 4 à l'an 8).
Pistes pour le V2, qui ajoute justement des nouveautés « de saison » : troc avec les clients toute l'année, croisements
(l'été), 4 habitants du V2 dont un d'hiver.

## 13. Sauvegardes et migrations

- **Une seule clé d'état** : `state.career.valley` (carrière seulement), ajoutée par l'extension `valley` à la création
  et au chargement ; `CAREER_VERSION` inchangée (champs ajoutés, comme les lots 3 et 4) ; flux `state.rng.valley` créé
  à la première reprise.
- **Ancienne carrière** (rang ≥ 2) : la boîte de Joseph arrive à la première aube après la reprise ; **tous les bocaux
  déjà trouvés** sont à ouvrir (le tableau `state.career.heirlooms` ne change pas : il reste la trace des trouvailles de
  l'album, `valley.jars.opened` dit combien sont ouverts). Rang 1 : rien jusqu'au rang 2.
- **Parcelles** : champs ajoutés `variety`, `fallow`, `rested`, `lastVariety` (vérifiés par `save.js`) ; une parcelle
  sans eux est une parcelle ordinaire.
- **Progression** : pages d'album et succès ajoutés par `normalizeProgress` (pas de changement de schéma) ; rien à
  rattraper (contenu nouveau).
- **D'un lot de la Vallée au suivant** : l'extension complète `state.career.valley` (version `v`), rien n'est retiré ;
  les pages d'album nouvelles ne changent jamais une page existante.
- **Option** `createCareer({ valley: false })` (tests, simulation) : `state.career.valley = null`, gardé tel quel à la
  reprise.

---

## 14. Risques et parades

| Risque | Parade |
|---|---|
| **Trop de systèmes à lire** (variétés, traits, recettes, étapes) | Une seule fiche, un seul indice à la fois, recettes en lignes cochées, traits picto + mot, conseils « première fois » ; le V1 ne compte que 12 + 12 éléments. |
| **Un trait devient dominant** (une culture semée partout) | Traits modestes, sur des cultures différentes ; graines rares avant fixation ; mesure de la part des semis (§ 12.3). |
| **Inflation des revenus** | Cibles chiffrées, services plafonnés, observation obligatoire (rien pour une ferme sans fermier), argent surtout dépensé « pour la beauté ». |
| **Rangs retardés** par les dépenses | Dépenses comptées à 100 % au patrimoine (§ 8) ; robots qui aménagent surtout après le rang 5 ; cible « à un an près ». |
| **Volume d'art** (12 variétés, 12 bêtes, haies en autotuile par saison, aménagements, vignettes) | Planche `valley1.png` limitée au V1 (§ ARCHITECTURE) ; variétés = icône + dessin mûr seulement ; repli dessiné (`canDraw`) si une image manque ; V3 et V4 ont leurs planches. |
| **Emplacements en conflit avec le décor existant** (ruches en x 1, coins `lotN.corner`, aire des machines, panneaux) | Le cœur ne connaît que les identifiants ; RENDER place et le test vérifie qu'aucun emplacement ne chevauche parcelle, chemin, bâtiment, ruche ou coin de décor. |
| **Performances** (bêtes qui se promènent sur une grande carte) | 6 bêtes dessinées au plus, hors de la vue rien n'est dessiné, pas de recherche de chemin. |
| **Ressemblance avec Stardew** (V3 : lieux restaurés) | Lieux naturels (pas des bâtiments), conditions de vie venues de la ferme, temps de reprise, aucun panier ; à confirmer par l'utilisateur (§ 15). |
| **Doublons d'album** (rouge-gorge à la mangeoire et habitant) | Conditions différentes, texte « déjà vu à la mangeoire » ; jamais de case ajoutée à une page existante. |
| **Culpabiliser** (bête qui part, jachère « perdue ») | Rien ne repart ; une bête attend ; une jachère interrompue n'enlève rien. |
| **Ajouter des cultures change les tirages** (V3 : cerisier, poirier) | Liste à part, hors de `CROPS` (comme les graines rares). |
| **Saisons de 10 ou 14 jours** | Temps exprimés en saisons (chêne adulte : 2 saisons) ; pas de seuil compté en jours. |

---

## 15. Points à trancher (recommandation en premier)

1. **Contenu du V1** : (a) graines **et** premiers habitants ensemble (recommandé : c'est déjà la Vallée vivante, tient
   la promesse des bocaux et des veillées) ; (b) les graines seules d'abord, la faune au V2 ; (c) la faune seule d'abord.
2. **S'installer** : (a) la bête attend qu'on la **touche** pour s'installer (recommandé : le geste du fermier, aucune
   machine ne le fait) ; (b) elle s'installe seule, le toucher ne sert qu'à l'album.
3. **Dépenses de la Vallée au patrimoine** : (a) 100 % (recommandé : aucun rang retardé) ; (b) 50 % comme les bâtiments ;
   (c) 0 % (« pour la beauté » pur, mais rangs un peu plus lents).
4. **Variétés fixées et équipe** : (a) l'équipe et le semoir peuvent les semer, sans jamais garder de graines (recommandé) ;
   (b) à la main seulement, comme les graines rares.
5. **Lieux de la vallée (V3)** : (a) chantier en pièces **et** condition de vie **et** temps de reprise (recommandé : vrai
   puits d'argent, logique écologique) ; (b) conditions de vie seulement (aucun puits d'argent) ; (c) pièces seulement
   (plus proche d'une restauration « achetée »).
6. **Longueur de la traîne** (tout restauré pour le joueur tranquille) : (a) vers l'an 18 (recommandé) ; (b) vers l'an 14
   (prix des chantiers et terres ÷ 1,5) ; (c) vers l'an 25.
7. **Terres sauvages** : (a) au V3, une fois les 16 terrains achetés (recommandé) ; (b) au V4 ; (c) jamais (seulement la
   vue de la vallée).
8. **Habitants du V2** : (a) dans une page d'album nouvelle « Les habitants (suite) » (recommandé) ; (b) dans la page des
   croisements.

## Décisions de l'utilisateur (2026-10-03)

1. Contenu du V1 : **graines et premiers habitants ensemble**.
2. Installation d'une bête : **il faut la toucher** (elle attend sans limite de temps).
3. Lieux du V3 : **chantier payé + condition de vie + temps de reprise**.
4. Durée de la restauration complète pour le joueur tranquille : **vers l'an 18**.

Points non posés, tranchés selon la recommandation de la conception : dépenses de la Vallée comptées à 100 % dans le patrimoine ; variétés fixées semables par l'équipe et le semoir sans jamais garder de graines ; terres sauvages au V3, après les 16 terrains.

---

## 16. Lot V2 « Le troc et les croisements » — conception détaillée (2026-10-03)

Conception complète du lot V2 ; elle **remplace l'aperçu du § 11.2** partout où les deux diffèrent (écarts listés au
§ 16.14). Contrats de code : `docs/ARCHITECTURE.md`, « Vallée vivante — contrats du lot V2 ». Résumé : `docs/GAME_DESIGN.md`
§ 18. Comme au V1, les chiffres sont des **valeurs de départ** réglées ensuite par `tools/simulate-career.js
--compare-valley2` ; la version qui fait foi vivra dans `src/data/career/heritage.js` et `src/data/career/valley.js`.

### 16.0 En bref

**L'idée.** La boîte en fer était le début ; le V2 donne aux graines **une maison** (la Grainothèque, derrière la ferme),
**des voisins** (chacun des 12 clients du tableau garde une variété de son jardin et l'échange contre une des vôtres) et
**un nom** (deux variétés d'une même culture semées côte à côte se croisent : la graine née chez vous porte le nom de la
ferme). C'est « l'héritage qui porte votre nom ».

**En une phrase de jeu.** Le joueur **échange** une graine sauvée contre la graine d'un voisin (un sachet épinglé au
tableau du village, une fois par saison), **sème côte à côte** la variété du pays et celle du village, les **récolte à la
main** jusqu'au croisement (barre « 2 / 3 rencontres », sans hasard), puis **sauve** la nouvelle variété ; l'argent de la
ferme agrandit la Grainothèque, qui montre toute la collection sur ses étagères.

**Ce que ça résout.**

| Problème (V1, § 12.7) | Réponse du V2 |
|---|---|
| **Creux de nouveautés** : 65 % des saisons au lieu de 80 % (ans 6 et 7, printemps et hivers des ans 8 à 10) | Une proposition de troc **par saison** (hiver compris, et chaque foire aux graines), 23 variétés de plus à sauver, 11 croisements, 5 niveaux de Grainothèque, 4 habitants dont **un d'hiver** (le merle) et un de printemps (l'osmie), 4 récits de Joseph (§ 16.11). |
| L'argent s'entasse (≈ 175 000 en caisse à l'an 14) | La Grainothèque : **58 000** pièces de puits « pour la beauté », comptées à 100 % au patrimoine (aucun rang retardé). |
| Après les 12 variétés du pays, plus rien à semer de neuf | 12 variétés du village + 11 variétés croisées, chacune avec ses traits (deux pour les croisées). |
| « Revoir la boîte » (idée du journal V1) | Bouton **« Revoir la boîte »** : la fiche de la boîte de Joseph se relit à tout moment, avec l'état actuel de ses trois variétés (§ 16.10). |

**Règles d'or du V2** (en plus de celles du § 0) :

1. **Aucune monnaie nouvelle, aucun coût caché** : le troc ne coûte rien (la Grainothèque garde toujours une poignée de
   graines de chaque variété sauvée) ; seules la Grainothèque et le nichoir à chauves-souris coûtent des pièces.
2. **Rien d'aléatoire frustrant** : propositions de troc et croisements sont **déterministes** (ordre fixe, barres
   visibles) ; le seul hasard nouveau est la venue des 4 habitants du V2 (comme au V1), sur un **flux nouveau, `valley2`**.
3. **Rien ne se perd, rien n'expire** : un troc proposé attend sans limite ; une rencontre de croisement ne se perd jamais ;
   une planche d'essai perdue rend sa graine (règle du V1, étendue aux 23 nouvelles variétés).
4. **Le joueur au centre** : échanger, semer la paire, récolter à la main, observer — jamais l'équipe ni les machines. Une
   récolte de l'équipe ne compte jamais comme une rencontre.
5. **Carrière seulement, niveaux identiques** : aucun champ, aucun flux, aucune règle en partie de niveau ; seules trois
   pages d'album se voient dans la grange (« À découvrir dans Ma ferme »).
6. **Aucun flux existant ne bouge** : `valley` (V1) tire exactement les mêmes nombres qu'avant (12 espèces du V1, haies,
   bocaux, étal) ; `orders`, `variety`, `events`, `cozy`… inchangés.

### 16.1 La boucle de jeu du V2

| Échelle | Ce que fait le joueur (de ses mains) |
|---|---|
| Quelques secondes | Toucher le sachet épinglé au tableau → choisir une de ses graines sauvées → « Échanger » ; « Semer la paire » sur une parcelle vide ; récolter à la main une planche d'essai voisine de sa jumelle (« + 1 rencontre ») ; ouvrir le sachet doré d'un croisement. |
| Une journée | Lire le prochain indice (« La Carotte violette et la Carotte jaune du Doubs ne demandent qu'à se rencontrer ») ; ranger une planche de croisement au champ de départ. |
| Une saison | Un troc (un voisin épingle un sachet le 2ᵉ jour) ; sauver une variété du village ; un croisement de temps en temps. |
| Une année | Un niveau de Grainothèque ; le troc de la foire aux graines ; un habitant du V2 ; un récit de Joseph. |
| Plusieurs années | V2 complet (12 trocs, 11 croisements, 35 variétés sauvées, Grainothèque niveau 5, 16 habitants) vers l'**an 11 à 13** pour le joueur tranquille ; le V3 (« Le ruisseau ») prend le relais jusqu'à l'**an 18** (décision de l'utilisateur). |

Session type (rang 5, an 7, printemps) : « Le 2ᵉ jour, un sachet est épinglé au tableau : Mme Chevalier propose sa tomate
noire de Crimée. Je lui donne mes fraises Reine des Vallées (elle adore les fraises : 4 graines au lieu de 3). Cet été,
je sèmerai la paire : tomate noire à côté de ma Cœur de bœuf. Au champ de départ, je récolte à la main ma Carotte violette,
voisine d'une Jaune du Doubs : 3 / 3 rencontres, un sachet doré saute — la Carotte de la Ferme des Tilleuls ! »

### 16.2 La Grainothèque (bâtiment à 5 niveaux)

**Où.** Un **emplacement réservé dans la bande de la maison** (2 × 2 tuiles, « au bout de l'allée, derrière la maison »),
comme le grenier et l'étal : **aucun emplacement de bâtiment** de pré, de basse-cour ou de cour des ateliers n'est pris
(une grande ferme les a souvent tous remplis : rien ne doit bloquer). Le cœur ne connaît que le niveau ; RENDER place le
rectangle (test : aucun chevauchement avec la maison, le grenier, l'étal, le puits, la mangeoire, le porte-lanternes, la
boîte en fer, les nichoirs, l'aire des machines). Ce n'est **pas** un bâtiment de `BUILDINGS` (pas de fenêtre de bâtiment
générique, pas d'entretien, pas de règle « 50 % au patrimoine ») : c'est un ouvrage de la Vallée, payé comme les
aménagements (poste « La Vallée », **100 % au patrimoine**).

**Quand.** À la première aube où la Vallée est commencée et la ferme au **rang 3**, Joseph raconte « Une idée de Joseph »
(récit `heritage0`, § 16.11) et un **panneau de bois** apparaît sur l'emplacement (« Ici, une grainothèque ? ») : le
toucher ouvre la fiche « La Grainothèque » (construction). Avant le rang 3 : rien.

**Les 5 niveaux** (total **58 000**, comme prévu au § 11.2 ; prix et rangs réglables, § 16.12) :

| Niveau | Nom | Prix | Rang | Ce qu'il débloque | Ce qu'on voit (scène, 32 × 32) |
|---|---|---|---|---|---|
| 1 | La remise aux graines | **2 000** | 3 | **Troc de saison** (une proposition par saison, cercle 1 : 4 voisins) ; l'**étagère** (la collection dans la fiche) ; récit « La remise aux graines » | petite remise de pierre sèche, toit de tuiles moussues, porte bleue, une fenêtre où brillent des bocaux |
| 2 | La petite grainothèque | **5 000** | 4 | **+ 1 graine** par récolte à la main d'une planche d'essai (**3** au lieu de 2) ; cercle 2 (+ 4 voisins) | un auvent de bois sous lequel sèchent des tresses de maïs et des têtes de tournesol ; un banc |
| 3 | La grainothèque | **10 000** | 5 | **Fixation en 5 récoltes à la main** (au lieu de 7) ; cercle 3 (+ 4 voisins) | maison de pierre à deux fenêtres, enseigne peinte « Grainothèque », étagères de bocaux visibles |
| 4 | Le jardin d'essai | **16 000** | 5 | **Croisement en 2 rencontres** (au lieu de 3) | un petit jardin clos de piquets devant la porte, quatre rangs étiquetés, une ruche en paille |
| 5 | La grainothèque vivante | **25 000** | 6 | Graines des variétés sauvées **au prix normal** (× 1 au lieu de × 1,25) ; **touristes + 15 %** (ils viennent voir les bocaux) ; récit « La grainothèque vivante » | un rosier grimpant sur la façade, la porte ouverte, des visiteurs qui s'arrêtent devant |

- Les effets valent pour **toutes** les variétés (du pays, du village, croisées) : le V2 accélère aussi la fin du V1.
- Un niveau s'achète d'un geste (« Agrandir · 5 000 ») dans la fiche ; le bâtiment change sous les yeux (fondu, étincelles ;
  mouvements réduits : changement direct). Aucun niveau ne se perd ; aucun entretien.
- **Ce qu'elle montre** : sa fiche (§ 16.9.1) est la **vitrine de la collection** — 35 bocaux rangés sur trois étagères
  (du pays, du village, de la ferme), le tableau des croisements, les 12 voisins du troc. Toucher le bâtiment ouvre cette
  fiche ; la carte « La Grainothèque » de l'onglet Graines de « La Vallée » y mène aussi.
- **Pour la beauté** : au-delà du niveau 1 (qui ouvre le troc de saison), chaque niveau est surtout un plaisir de voir la
  remise devenir maison ; ses effets restent modestes (§ 16.12.3).

### 16.3 Le troc de graines avec les 12 voisins

**Principe.** Chaque client du tableau du village garde **une variété de son jardin**. Quand il **propose un troc**, il
épingle un **sachet** au tableau ; le joueur lui donne **3 graines d'une variété sauvée** (au choix, n'importe laquelle
sauf la sienne), il donne **3 graines de la sienne** (un greffon pour Léon : 3 greffons). **Une fois par voisin.** Le troc
ne coûte rien : la Grainothèque (ou, avant elle, la boîte en fer) garde toujours une poignée de chaque variété sauvée.

**Ce que chacun aime (♥).** Si la variété donnée est d'une culture **préférée** du voisin (ses préférées du tableau, lot 3),
il rend **4 graines au lieu de 3** et dit un petit mot ; la case d'album reçoit le tampon ♥. Une variété croisée (au nom de
la ferme) déclenche une phrase spéciale (« Une graine de la Ferme des Tilleuls ! Je la planterai devant chez moi. »).
Jamais de refus, jamais de « mauvais » choix.

**Les 12 voisins et leurs variétés** (ordre fixe des propositions ; cercle = niveau de Grainothèque qui ouvre le troc de
saison avec eux ; (†) vraie variété ancienne du domaine public) :

| Ordre | Voisin | Cercle | Variété (id) | Culture | Trait | Sa proposition | Son merci |
|---|---|---|---|---|---|---|---|
| 1 | Lili, la petite voisine | 1 | Carotte violette (`carotteViolette`) | carotte | Généreuse | « Mes carottes violettes contre une de tes graines ? Caramel est d'accord ! » | « Je vais la semer à côté de la cabane de Caramel ! » |
| 2 | Le père Fabre | 1 | Courgette blanche de Virginie (†) (`blancheDeVirginie`) | courgette | Mellifère | « Ma courgette blanche, celle des pique-niques. Un échange ? » | « Je la planterai près de l'étang. » |
| 3 | M. Garnier | 1 | Pomme de terre bleue d'Artois (`bleueDArtois`) | pomme de terre | Rustique | « Une pomme de terre bleue, pour la leçon de sciences. On échange ? » | « Les enfants vont la semer dans le jardin de l'école. » |
| 4 | Mme Morel | 1 | Navet des Vertus Marteau (†) (`marteauDesVertus`) | navet | Savoureuse | « Mes navets des Vertus donnent une teinture ivoire. Vous m'échangez ? » | « Je teindrai une laine à vos couleurs. » |
| 5 | Paulo | 2 | Blé barbu du Roussillon (†) (`barbuDuRoussillon`) | blé | Parfumée | « Mon blé barbu fait la meilleure farine du canton. On échange ? » | « Je t'apporterai la première miche ! » |
| 6 | Mme Chevalier | 2 | Tomate noire de Crimée (†) (`noireDeCrimee`) | tomate | Savoureuse | « La tomate noire de ma grand-mère, contre une graine de chez vous ? » | « Elle ira dans le potager de l'auberge. » |
| 7 | Mme Rose | 2 | Tournesol velours rouge (`veloursRouge`) | tournesol | Généreuse | « Mon tournesol velours rouge, contre une graine qui fleurit ? » | « Elle sera dans mes bouquets l'été prochain. » |
| 8 | Mamie Odette | 2 | Chou cœur de bœuf des Vertus (†) (`coeurDeBoeufDesVertus`) | chou | Géante | « Mon chou des Vertus tient tout l'hiver. Tu m'en donnes une des tiennes ? » | « Passe goûter la soupe cet hiver ! » |
| 9 | Mlle Perrin | 3 | Fraise Madame Moutot (†) (`madameMoutot`) | fraise | Parfumée | « La fraise Madame Moutot, parfumée comme une sonate. Un troc ? » | « Je jouerai un air pour elle, au jardin. » |
| 10 | M. le maire | 3 | Maïs blanc des Landes (`blancDesLandes`) | maïs | Sobre | « Le maïs blanc des Landes, pour le buffet. La mairie propose un échange ! » | « Au nom du village, merci pour ces graines ! » |
| 11 | Zoé et Bastien | 3 | Citrouille galeuse d'Eysines (†) (`galeuseDEysines`) | citrouille | Savoureuse | « On a des graines de citrouille galeuse, chut… on échange ? » | « Promis, on la plantera devant la cabane ! » |
| 12 | Léon, le facteur | 3 | Pomme Api étoilé (†) (`apiEtoile`, greffon) | pommier | Parfumée | « Un greffon d'Api étoilé, de l'arbre de mon grand-père. Un échange ? » | « Je la planterai sur ma tournée, au bord du chemin. » |

Anecdotes (≤ 110 caractères, lues dans la fiche et l'album) et étiquettes des sachets (« De la part de Lili », écrites à
la main) :

| Variété | Anecdote |
|---|---|
| Carotte violette | Violette dehors, orange dedans : Lili jure que Caramel la préfère. Il n'a jamais dit le contraire. |
| Courgette blanche de Virginie | Pâle comme la lune : ses grandes fleurs attirent les abeilles dès l'aube, dit le père Fabre. |
| Pomme de terre bleue d'Artois | Bleue jusqu'au cœur : les enfants de la cantine la réclament à chaque rentrée. |
| Navet des Vertus Marteau | Long et blanc, le navet des maraîchers d'autrefois : sa chair fine fond dans le pot-au-feu. |
| Blé barbu du Roussillon | Ses longues barbes dorées ondulent au vent ; sa farine sent la noisette, dit Paulo. |
| Tomate noire de Crimée | Sombre comme une prune, juteuse comme une pêche : la fierté de la soupe de l'auberge. |
| Tournesol velours rouge | Ses pétales rouge sombre ont l'air de velours : Mme Rose en met au cœur de ses bouquets. |
| Chou cœur de bœuf des Vertus | Pointu comme un cœur : Mamie Odette le fait mijoter tout l'hiver dans sa grande marmite. |
| Fraise Madame Moutot | Grosse, ronde et parfumée : on la cultivait déjà au temps des grands-parents de Mlle Perrin. |
| Maïs blanc des Landes | Il pousse dans le sable sans boire : le maire en sert la cruchade à chaque buffet. |
| Citrouille galeuse d'Eysines | Couverte de petites bosses : plus elle est galeuse, plus elle est sucrée ! |
| Pomme Api étoilé | Une petite pomme à cinq côtes, en étoile : Léon en garde toujours une dans sa sacoche. |

**Le rythme (déterministe, sans échéance).** Une **seule proposition à la fois** ; elle **attend** sans limite (jamais
retirée, jamais rappelée). Une proposition nouvelle n'apparaît que si aucune n'attend, et :

1. **Troc de la foire** — chaque **dernier jour d'hiver** (foire aux graines, même sans les fêtes du lot 4), dès que la
   Vallée est commencée et qu'**une variété au moins est sauvée** : « À la foire, tout le village est là » — le **prochain
   voisin de l'ordre**, tous cercles confondus. C'est l'avant-goût, sans Grainothèque (une par an).
2. **Troc de saison** — avec la Grainothèque (niveau ≥ 1), à l'aube du **2ᵉ jour de chaque saison** (hiver compris ; le
   1ᵉʳ jour a déjà la charrette, les cartes et les défis) : le prochain voisin dont le **cercle** est ouvert (niveau ≥
   cercle), en préférant le premier de l'ordre dont la culture **se sème cette saison ou la suivante** (ou toute l'année
   avec une serre) ; sinon le premier de l'ordre. Léon attend qu'il y ait un **verger**.

Avec ces deux sources, le joueur tranquille fait **un troc par saison ou presque** des ans 4 à 9 (N1 vers l'an 4, N2 vers
l'an 6, N3 vers l'an 8, § 16.12) ; un joueur qui ne bâtit jamais la Grainothèque en fait un par an (à la foire), et rien
n'est perdu.

**Intégré au tableau du village, sans doublon.** Le troc **n'est pas une commande** : il ne prend aucune des 3 places du
tableau, ne demande aucune récolte, ne paie aucune prime, ne touche ni au générateur « faisable cette saison » ni au flux
`orders`. Il se voit **au tableau** : un petit **sachet kraft épinglé** sur le panneau du village (scène) ; dans la feuille
du tableau, une **carte « Troc »** au-dessus des commandes (portrait, une ligne, bouton « Choisir une graine ») ; si le
même voisin a aussi une commande, sa carte porte un petit sachet. Le tableau désactivé (option de test) : le troc reste
dans la fiche de la Grainothèque et la ligne « À faire ». Les commandes ne demandent **jamais** une variété (inchangé).

**Écho doux.** Une fois le troc fait, le merci d'une commande livrée par ce voisin est, une fois sur trois (hachage pur de
l'identifiant de la commande, sans tirage), remplacé par une phrase de son jardin (« Vos fraises Reine des Vallées ont
pris dans mon jardin ! ») : le village cultive vos graines.

### 16.4 Les croisements : 11 variétés qui portent le nom de la ferme

**La règle, en une phrase (lue dans la fiche) :** « Semez côte à côte les deux variétés d'une même culture ; chaque fois
que vous en récoltez une **à la main** pendant que l'autre pousse **juste à côté**, les abeilles font une rencontre. **3
rencontres** : une graine nouvelle, au nom de votre ferme. »

| Règle | Valeur |
|---|---|
| Parents | pour chaque culture (sauf le pommier) : la **variété du pays** (V1) et la **variété du village** (§ 16.3) — table fixe, rien à deviner |
| Voisines | même terrain (champ, champ de départ ou serre), **par un côté** (pas en diagonale) : colonnes et lignes de `query.plot(i)` |
| Une **rencontre** | récolte **à la main** d'une parcelle d'un parent pendant qu'une parcelle voisine porte **l'autre parent** (semé, à n'importe quel stade) ; **une** rencontre par récolte au plus, même entourée ; récolte de l'équipe ou d'une machine : jamais |
| Croisement | à **3 rencontres** (Grainothèque niveau 4 : **2**) ; avec l'**osmie** installée, chaque rencontre compte **double** |
| Ce qu'on reçoit | un **sachet doré de 3 graines** de la variété croisée (popup : le sachet s'ouvre, le nom s'écrit) ; puis on la **sauve** comme les autres (planches d'essai, 7 récoltes à la main, 5 au niveau 3) |
| Traits | les **deux traits** des parents (tableau ci-dessous) ; jamais de trait perdu ; une variété croisée n'a pas de génération suivante au V2 (le V4 s'en servira pour les légendes) |
| Ce qui ne se perd pas | les rencontres (compteur par culture, jamais en baisse) ; une variété croisée trouvée ; ses graines (planche perdue : la graine revient) |
| Grainothèque nécessaire ? | **Non** : c'est l'affaire des abeilles ; la Grainothèque l'accélère seulement (niveau 4) |

**Le nom.** « {Culture} {de la ferme} » : « Tomate de la Ferme des Tilleuls », « Navet de Chez Martin ». La préposition
suit le nom de la ferme (`ofFarm`, comme `ofLot` du V1) : « Le X » → « du X » ; « La X » → « de la X » ; « Les X » → « des X » ;
« L'X » → « de l'X » ; un nom commençant par Ferme, Maison, Grange, Bergerie, Métairie, Bastide, Closerie → « de la … » ;
une voyelle → « d'… » ; sinon « de … ». Le nom suit le nom actuel de la ferme (calculé, jamais enregistré). Sur un écran de
360 px, le nom va à la ligne ; dans les listes serrées, « Tomate · de la ferme » et le sceau doré suffisent.

**Les 11 variétés croisées** (id, traits hérités, petit texte, teinte) :

| id | Culture | Parents (pays × village) | Traits | Petit texte (≤ 110 caractères) |
|---|---|---|---|---|
| `crossCarrot` | carotte | Jaune du Doubs × Carotte violette | Savoureuse + Généreuse | Ni jaune ni violette : orangée au cœur pourpre, comme un coucher de soleil. |
| `crossTurnip` | navet | Boule d'or × Navet des Vertus Marteau | Précoce + Savoureuse | Doré et allongé, il pousse vite et fond dans la bouche : le meilleur des deux. |
| `crossWheat` | blé | Rouge de Bordeaux × Blé barbu du Roussillon | Sobre + Parfumée | Des épis roux à longues barbes : il tient la sécheresse et sa farine sent le pain chaud. |
| `crossCabbage` | chou | Milan de Pontoise × Cœur de bœuf des Vertus | Généreuse + Géante | Cloqué et pointu à la fois : un chou si grand qu'il faut deux bras pour le porter. |
| `crossTomato` | tomate | Cœur de bœuf × Noire de Crimée | Généreuse + Savoureuse | Grosse, côtelée, presque noire : une seule tranche fait une tartine. |
| `crossCorn` | maïs | Grand roux basque × Blanc des Landes | Rustique + Sobre | Des grains roux et blancs mêlés, comme un épi en habit de fête. |
| `crossSunflower` | tournesol | Soleil d'or × Velours rouge | Mellifère + Généreuse | Or au bord, velours au cœur : les abeilles font la queue pour s'y poser. |
| `crossPotato` | pomme de terre | Vitelotte × Bleue d'Artois | Savoureuse + Rustique | Violette et bleue marbrée : la purée en devient couleur lavande. |
| `crossStrawberry` | fraise | Reine des Vallées × Madame Moutot | Mellifère + Parfumée | Petite comme une fraise des bois, parfumée comme une Moutot : un trésor de confiture. |
| `crossZucchini` | courgette | Ronde de Nice × Blanche de Virginie | Précoce + Mellifère | Ronde et pâle, elle pousse en un clin d'œil sous ses grandes fleurs jaunes. |
| `crossPumpkin` | citrouille | Rouge vif d'Étampes × Galeuse d'Eysines | Géante + Savoureuse | Rouge vif et galeuse : la citrouille des contes, en plus sucrée. |

Les traits du village ont été choisis **différents** de ceux du pays pour chaque culture : un croisement a toujours deux
traits distincts (la règle « trait en double → un troisième » de l'aperçu devient inutile ; la table fixe fait foi).
Aucun trait n'est mis là où il ne servirait à rien (le navet et le chou résistent déjà au gel : pas de « rustique » ; la
pomme de terre pousse déjà sans eau : pas de « sobre »).

**Jouable au doigt.**
- **« Semer la paire »** (fiche d'un croisement, fiche d'une variété du village, prochain indice) : la scène passe en mode
  « paire » (comme le mode aménagement) : les parcelles vides **qui ont une voisine vide** pulsent ; un toucher sème le
  parent du village sur la parcelle touchée et le parent du pays sur la voisine (droite, puis gauche, dessous, dessus) —
  graines gardées d'abord, sinon (variété sauvée) au prix de la graine. Un seul geste pour une planche de croisement.
- **Dans la scène**, deux parents voisins sont reliés par un **petit vol d'abeille** (une abeille qui fait l'aller-retour ;
  mouvements réduits : un point de pollen fixe entre les deux parcelles) ; la fiche de la parcelle dit « Croisement avec
  Carotte violette (à côté) : 2 / 3 rencontres · récoltez-la à la main ».
- À la récolte à la main : texte flottant « + 1 rencontre · 2 / 3 » ; au croisement : le sachet doré saute de la parcelle.

### 16.5 Le nouveau trait : Parfumée

| id | Trait | Picto | Effet |
|---|---|---|---|
| `scented` | Parfumée | petite fleur au parfum (trois traits ondulés) | à l'atelier, le produit fait de cette récolte vaut **+ 15 %** (confiture de fraises, jus de pomme, farine, pain) |

- Porté par le Blé barbu du Roussillon, la Fraise Madame Moutot, la Pomme Api étoilé et deux croisées (blé, fraise) : les
  trois cultures qu'un atelier transforme. Sans atelier allumé, il ne fait rien (la fiche le dit).
- Règle de cœur : une récolte de variété ne va jamais au grenier (V1) ; si elle part à l'atelier, le **rendement de la
  place** (`yieldFactor`) est multiplié par 1,15 au moment où elle y entre (aucune donnée nouvelle dans les places
  d'atelier, aucun changement du module partagé `processing.js`).
- Une variété croisée a **deux traits** : chaque règle de trait du V1 lit désormais « la variété a ce trait » (liste) au
  lieu de « le trait de la variété est celui-ci ».

### 16.6 Quatre habitants de plus (page d'album nouvelle « Les habitants (suite) »)

Même règles que le V1 (recette lisible, indice, venue, **il faut les toucher**, service doux), sur le flux **`valley2`**
(4 nombres par aube, un par espèce, qu'elle soit candidate ou non) ; une seule venue annoncée par aube **toutes espèces
confondues** (si une espèce du V1 s'est annoncée ce matin, celles du V2 attendent : aucun tirage en moins ni en plus).

| id | Espèce | Recette d'habitat | Arrive | Service (installée) | Où on la voit |
|---|---|---|---|---|---|
| `wildBee` | Osmie (abeille maçonne) | 2 hôtels à insectes + 3 coins fleuris | **printemps** | chaque **rencontre de croisement compte double** | sur un hôtel à insectes |
| `blackbird` | Merle noir | 6 haies + 1 arbre adulte (chêne isolé ou pommier) | **hiver** | **cueillette des haies : 4 trouvailles** à la fois au lieu de 3 | en haut d'une haie |
| `lizard` | Lézard des murailles | 3 tas de bois et de pierres + 1 friche ou jachère fleurie | été | les jours de **canicule**, pousse **+ 10 %** | sur un tas de pierres |
| `bat` | Pipistrelle | 1 **nichoir à chauves-souris** + la mare | été, automne | **l'été, l'équipe n'est jamais lasse** (on prend le frais, le soir, à les regarder voler) | au nichoir, au crépuscule |

| Espèce | Indice (la veille) | Anecdote |
|---|---|---|
| Osmie | « De petits bouchons de terre au bout des tiges de l'hôtel… » | Elle ferme chaque tige de son nid avec un bouchon de terre, comme une maçonne. |
| Merle noir | « Un chant flûté, au crépuscule, tout en haut de la haie… » | Il chante dès la fin de l'hiver, perché au plus haut, pour dire « ici, c'est chez moi ». |
| Lézard des murailles | « Une petite queue qui file entre les pierres, en plein soleil… » | Il se chauffe au soleil le matin : sans chaleur, il ne peut pas courir. |
| Pipistrelle | « Au crépuscule, de petites ombres zigzaguent au-dessus de la mare… » | Pas plus lourde qu'une pièce, elle mange des milliers de moucherons chaque nuit. |

Accords : l'osmie (f), le merle noir (m), le lézard (m), la pipistrelle (f) ; « Bienvenue, petite osmie ! », « Bienvenue,
beau merle ! », « Bienvenue, petit lézard ! », « Bienvenue, petite pipistrelle ! ».

**Nouvel aménagement : le nichoir à chauves-souris** (`batbox`) — **100 + 50 × n**, rang **4**, beauté 1 (dans le plafond
de 6 du V1). Emplacements : 1 sous l'avant-toit de la maison (`home.bat`), 1 par verger (`<lot>.bat`, « dans un vieux
pommier »), 1 par cour des ateliers (`<lot>.bat`, « sous l'avant-toit »). Petite caisse plate de bois sombre, fente en bas.

### 16.7 Les signes de vie et les étapes

- Un signe de vie = une espèce installée ou une variété sauvée, **V2 compris** : 16 espèces + 35 variétés = **51** (au
  lieu de 24) — décision de l'utilisateur (§ 16.15, point 4).
- **Paliers recalés à l'intégration (2026-10-03)** : avec les paliers du V1 (2 / 6 / 11 / 17 / 24), l'étape 5 « La vallée
  chante » venait à l'**an 6** du joueur tranquille (les 23 variétés du V2 se sauvent au rythme de celles du pays). Quand
  le V2 est ouvert (partie `heritage`), les paliers sont **2 / 6 / 11 / 22 / 38** (`STAGE_SIGNS_V2`,
  `src/data/career/valley.js`) : étapes 1 à 4 aux mêmes années que le V1 (ans 2 / 3 / 4 / 6), étape 5 à l'**an 9** (au
  lieu de l'an 11 au V1 seul) ; les étapes 1 à 3 ne changent pas, le débutant n'est pas retardé (étapes 1 et 2 aux ans 3
  et 6, étape 3 vers l'an 13, comme avant). Sans le V2 (`{ heritage: false }`) : les paliers du V1, exactement.
- **Jamais de recul** : une étape déjà atteinte (carrière du V1, ou du V2 avant ce recalage) reste acquise ; la
  vérification des sauvegardes borne l'étape avec les paliers du V1 (les plus bas). La prochaine étape demande le
  nouveau palier (une carrière à l'étape 4 avec 20 signes attend 38 signes pour l'étape 5).
- **À reprendre au V3** : les étapes 6 et 7 (30 et 45 signes au § 11.3) doivent passer **au-dessus de 38** (par exemple
  44 et 51) puisque l'étape 5 en demande désormais 38. *Fait au § 17.9 : **56** signes + le ruisseau à l'étape 2, et **76**
  signes + les six lieux à l'étape 2, sur 99 signes avec le V3.*
- La rangée de silhouettes de la fiche « La Vallée » devient « 31 signes de vie · prochaine étape à 45 » (après l'étape 5,
  le compteur continue pour le V3 ; tant que le V3 n'est pas là : « 31 signes de vie sur 51 »).

### 16.8 Liens avec l'existant (sans doublon)

| Existant | Ce que le V2 en fait | Pourquoi pas un doublon |
|---|---|---|
| **Tableau du village** (lot 3) | Le troc s'y épingle (sachet, carte « Troc ») ; écho dans les mercis | Pas une commande : aucune place, aucune récolte demandée, aucune prime, aucun tirage `orders` |
| **Clients du village** et leurs préférées (lot 3) | Les 12 mêmes voisins, leurs préférées donnent le ♥ du troc | Ni nouveau personnage, ni nouvelle amitié à gérer |
| **Foire aux graines** (lot 4) | Chaque année, le troc de la foire (sans Grainothèque) ; l'étal « La grainothèque du pays » du V1 ne change pas (variétés du pays seulement) | Un moment de plus d'une fête existante |
| **Stand de la ferme** (lot 4, fête des récoltes) | Carrière : **+ 1 point** par culture présentée dont une variété ancienne a été récoltée cette année | Une ligne de barème, gardée par `state.career.valley` |
| **Basile** (lot 3), **graines rares** | Inchangés (bocal ancien du pays ; pois, melon, poireau sans variété — le melon de la mère de Joseph reste la promesse du V4) | — |
| **Album** (lot 4) | Trois pages **nouvelles** : `swaps` (12), `crosses` (11), `wildlife2` (4) ; aucune case ajoutée à une page existante ; « L'album complet » reste les 11 pages du lot 4 | Règle du V1 |
| **Lanternes** | Inchangées (le critère « variété » compte des cultures, pas des variétés ; la beauté garde son plafond de 6 points nature) | — |
| **Joseph** | 4 récits de la Grainothèque (§ 16.11) ; quêtes et cœurs inchangés | La quête « variété ancienne » de l'aperçu est écartée (§ 16.14) |
| **Rangs, patrimoine** | Dépenses comptées à 100 % (Grainothèque, nichoirs) ; aucun objectif de rang ne dépend du V2 ; la Grainothèque apparaît dans les déblocages du rang 3, le nichoir à chauves-souris dans ceux du rang 4 | Règle du V1 |
| **F1 « aider sans remplacer »** | L'équipe et le semoir sèment les variétés **sauvées** (V2 comprises) ; jamais de rencontre, jamais de graine | Règle du V1 |

### 16.9 Écrans du téléphone (portrait, 412 × 915 et 360 × 740)

Cibles ≥ 48 px, textes ≥ 14 px (12 px pour les mentions), traits en pictogramme **et** en mot, pause pendant la lecture,
mouvements réduits partout, lecteurs d'écran (« 2 rencontres sur 3 », « sauvée », « troc fait »).

#### 16.9.1 La fiche « La Grainothèque » (feuille haute)

Ouverte par : le bâtiment (ou le panneau), la carte « La Grainothèque » en tête de l'onglet Graines de « La Vallée », la
carte « Troc » du tableau du village (« Voir la Grainothèque »), la ligne « À faire ».

```
┌──────────────────────────────────────┐
│ La Grainothèque                   ✕  │
│ ┌────────┐ Niveau 2                  │  vignette library.2 × 2 (× 1,5 sur 360 px)
│ │ [N2]   │ La petite grainothèque    │  16 px
│ └────────┘ ✓ Troc de saison          │  effets en lignes cochées (14 px)
│            ✓ 3 graines par récolte   │
│ [ Agrandir · 10 000 · rang 5 ]       │  ≥ 48 px ; grisé + raison lue sinon
│ [ L'étagère ][ Croisements ][ Troc ] │  segments ≥ 48 px
│  … contenu du segment …              │  défilement interne
└──────────────────────────────────────┘
```

- **Avant construction** (le panneau) : grande vignette du site, trois lignes (« Une maison pour vos graines ; le troc
  toute l'année ; vos bocaux rangés »), bouton « Construire · 2 000 » (ou « Rang 3 requis »). Les segments se voient déjà
  (l'étagère et les croisements sont consultables ; le troc dit « Le troc de la foire, en attendant »).
- **L'étagère** : trois étagères dessinées, « Du pays 12 / 12 », « Du village 4 / 12 », « De la ferme 1 / 11 » ; une
  grille de **4 bocaux par rangée** (tuile 72 × 72 : la variété dans un bocal de verre, pastille d'état : ✓ sauvée,
  « 3 » graines, silhouette grise « ? » à trouver) ; toucher un bocal → la fiche de la variété (V1, avec ses deux traits
  et, pour une variété du village, « De la part de Lili »).
- **Croisements** : 11 lignes (≥ 72 px) : `[icône pays] + [icône village] → [bocal doré ou ?]`, nom (connu) ou « ? », barre
  à segments « 2 / 3 rencontres » lue, bouton **« Semer la paire »** quand on a les deux parents ; sinon une ligne douce
  (« Il faut d'abord la Carotte violette : Lili la garde dans son jardin ») ; trouvée : « Sauvée ✓ » ou « 3 graines · 2 / 7 ».
- **Troc** : la proposition en attente en tête (carte comme au tableau), puis les **12 voisins** en grille de 3 (portrait
  48 px, icône de leur variété, ✓ ou cadenas doux « Grainothèque niveau 2 » / « Il faut un verger ») ; « 4 trocs sur 12 ».

#### 16.9.2 La feuille « Troc avec … » (feuille basse)

```
┌──────────────────────────────────────┐
│ [portrait 48] Mme Rose, la fleuriste │
│ « Mon tournesol velours rouge,        │
│   contre une graine qui fleurit ? »   │
│ Elle vous donne :                     │
│  [icône] Tournesol velours rouge      │
│          ★ Généreuse · 3 graines      │
│ Vous lui donnez (au choix) :          │
│  ○ [icône] Fraise Reine des Vallées ♥ │  lignes ≥ 56 px ; ♥ « Elle adore les fraises : 4 graines »
│  ○ [icône] Navet Boule d'or           │
│  ○ [icône] Carotte de la Ferme…  ✦    │
│ Ça ne vous coûte rien : la            │  12 px
│ grainothèque en garde toujours.       │
│ [          Échanger          ]        │  ≥ 56 px, actif dès qu'un choix est fait
└──────────────────────────────────────┘
```

Les préférées (♥) sont en tête ; puis les variétés du pays, du village, croisées. Après l'échange : le sachet glisse vers
la boîte (son « pop »), merci du voisin, « Semer » (montre une parcelle qui convient) ou « Plus tard ».

#### 16.9.3 Un croisement (popup, ≤ 50 % de l'écran)

```
┌──────────────────────────────────────┐
│     [sachet doré qui s'ouvre 64 px]   │
│         Un croisement !               │
│  Tomate de la Ferme des Tilleuls      │  16 px, va à la ligne
│  ★ Généreuse   ♥ Savoureuse           │  deux pastilles trait (picto + mot)
│  Née de Cœur de bœuf et Noire de      │
│  Crimée · 3 graines                   │
│ [ Semer ]           [ Plus tard ]     │  ≥ 48 px
└──────────────────────────────────────┘
```

Le premier croisement ouvre ensuite le récit « Le premier croisement » (§ 16.11).

#### 16.9.4 Fiches existantes enrichies

- **La Vallée › Graines** : en tête, la carte **« La Grainothèque »** (vignette, niveau, « Voir ») ; puis la proposition de
  troc s'il y en a une ; puis la liste du V1, **groupée** « En cours » (ouvert) · « Du pays » · « Du village » · « De la
  ferme » (repliés, ≥ 48 px, « 9 / 12 ») ; en bas, le bouton **« Revoir la boîte en fer »** (§ 16.10).
- **La Vallée › Habitants** : les 4 du V2 à la suite (même ligne que le V1) ; **› Aménager** : la carte du nichoir à
  chauves-souris.
- **Fiche d'une variété** : deux pastilles de traits pour une croisée ; « De la part de Lili » ; « Croisement avec … :
  2 / 3 rencontres » + « Semer la paire ».
- **Fiche d'une parcelle** : « Croisement avec Carotte violette (à côté) : 2 / 3 rencontres · récoltez-la à la main » ; « à
  côté : rien » → « Semez la Carotte violette juste à côté pour la croiser ».
- **Feuille des graines** : variétés du village et croisées dans « Graines anciennes » (sceau doré pour les croisées),
  ligne « Semer la paire » quand un croisement est possible.
- **Tableau du village** : carte « Troc » en tête (§ 16.3).
- **Ligne « À faire »** : `vl-troc` « Mme Rose propose un troc », `vl-story` « Joseph a quelque chose à vous dire » (récits).
  Aucune ligne pour pousser à acheter un niveau (aucune envie fabriquée).
- **Prochain indice** (toujours un seul), ordre : bête à voir ; chapitre ou récit ; **troc en attente** ; bocal ; planche
  d'essai mûre (« récoltez-la à la main : + 1 rencontre » si sa jumelle est à côté) ; **« semez la paire »** (une variété du
  village en main dont le croisement n'est pas trouvé et qu'aucune paire ne pousse) ; graines à semer (rien de semé) ;
  recette la plus proche ; **la Grainothèque** (construire, seulement si on peut la payer en gardant 2 saisons de charges) ;
  étape suivante.
- **Résumé du matin** : « Mme Rose a épinglé un sachet au tableau » ; « Hier : 2 rencontres au champ de départ ».
- **Bilan de l'année**, bloc « La vallée cette année » : + trocs, croisements, niveau de la Grainothèque.
- **Conseils « première fois »** : `valley.library` (premier niveau), `valley.troc` (première proposition), `valley.pair`
  (première paire semée), `valley.cross` (premier croisement), `valley.scented` (première variété parfumée semée).

#### 16.9.5 Scène

- La Grainothèque (2 × 2 tuiles, 5 dessins) ou son panneau ; touchable (cible agrandie ≥ 48 px).
- Le sachet épinglé au tableau du village quand un troc attend (le toucher ouvre la feuille du tableau, carte « Troc » en
  tête).
- L'abeille (ou le point de pollen) entre deux parents voisins ; le sachet doré d'un croisement.
- Le mode « paire » : parcelles valides en pointillé épais avec « + » (lisible sans la couleur), défilement, pincement et
  boutons + / − actifs, « Terminer » dans la barre.
- Les 4 habitants du V2 (indices, « ? », promenade douce comme au V1 ; 6 bêtes dessinées au plus, inchangé) ; le nichoir à
  chauves-souris ; au niveau 5, des visiteurs s'arrêtent devant la porte (décor).

### 16.10 « Revoir la boîte » (fiche de la boîte de Joseph relisible)

Constat du V1 : un toucher pendant la fenêtre « La boîte en fer » la fermait, et le détail des graines ne se revoyait plus.

- Un bouton **« Revoir la boîte en fer »** en bas de l'onglet Graines, et la ligne « La boîte en fer » des récits de Joseph
  (chapitre 0) ouvre désormais **la même fenêtre** que le premier jour, reconstruite depuis l'état : vignette, les trois
  lignes de Joseph, les **trois variétés** avec leur trait et leur **état actuel** (« 3 graines » · « 4 / 7 récoltes à la
  main » · « Sauvée ✓ »), la haie de Joseph (« Le champ de départ, côté gauche ») et la ligne du melon (« Le melon, lui,
  dort trop profond… », promesse du V4), bouton « Fermer ».
- La fenêtre du premier jour ne se ferme plus d'un toucher hors d'elle (il faut « Merci, Joseph ») : la règle de la veillée.
- Requête `valley().box` (contrat V2) ; aucun état nouveau.

### 16.11 Les récits de la Grainothèque (Joseph)

Fenêtre comme les chapitres (vignette, trois lignes, « Merci, Joseph »), qui **attendent** d'être lus (ligne « À faire ») ;
relisibles dans « Les récits de Joseph ». Ce ne sont pas des étapes (les étapes restent comptées en signes de vie).

| id | Titre | Quand | Vignette | Trois lignes |
|---|---|---|---|---|
| `heritage0` | Une idée de Joseph | première aube au rang 3 (Vallée commencée) ; le panneau apparaît | `story.library` | « Toutes ces graines, il leur faudrait une maison. » · « Derrière chez toi, il y a la place pour une petite remise en pierre. » · « Et les gens du village gardent des graines, eux aussi : on pourrait échanger. » |
| `heritage1` | La remise aux graines | Grainothèque niveau 1 | `story.library` | « Ma mère aurait aimé ça : des bocaux bien rangés, des étiquettes. » · « Ici, aucune graine ne se perdra plus. » · « Les voisins viendront épingler leurs sachets au tableau, tu verras. » |
| `heritage2` | Le premier croisement | premier croisement | `story.cross` | « Deux fleurs côte à côte, une abeille entre les deux… » · « Et voilà une graine qui n'existait nulle part ailleurs. » · « Elle porte le nom de ta ferme, maintenant. C'est ton héritage, petit. » |
| `heritage3` | La grainothèque vivante | Grainothèque niveau 5 | `story.library5` | « Les gens viennent de loin pour voir tes bocaux, tu sais. » · « Ma mère disait : une graine qu'on garde, c'est une graine qui dort. » · « Une graine qu'on donne, c'est une graine qui vit. » |

### 16.12 Équilibrage

#### 16.12.1 Repères (V1, § 12.7 et trace `--seed 3 --strategy casual --years 18`)

Joueur tranquille : rang 3 à 4 à l'an 3, rang 5 à l'an 5, Domaine à l'an 7 ; argent en caisse ≈ 2 000 à 17 000 des ans 3 à
10 (il investit), puis **50 000 (an 11) → 175 000 (an 14) → 340 000 (an 18)** ; revenu ≈ 50 000 par an après l'an 8 ;
récoltes à la main de variétés anciennes ≈ 20 à 35 par an ; nouveautés de la Vallée : **65 %** des saisons (ans 2 à 10).

#### 16.12.2 Calendrier visé du joueur tranquille

| An | Ce qui arrive (V2) | Nouveautés de saison apportées |
|---|---|---|
| 2 à 3 | troc de la foire (dès une variété sauvée) | l'hiver |
| 4 | Grainothèque **N1** (2 000) ; trocs de saison du cercle 1 ; premières variétés du village sauvées | 3 à 4 saisons |
| 5 | fin du cercle 1 ; premiers croisements (carotte, navet, courgette, pomme de terre) ; lézard (été) | 3 à 4 saisons |
| 6 | **N2** (5 000) ; cercle 2 ; osmie (printemps) ; croisements | 4 saisons |
| 7 | trocs du cercle 2 ; merle (hiver) ; variétés du village et croisées sauvées | 4 saisons |
| 8 | **N3** (10 000) ; cercle 3 ; croisements d'été (tomate, tournesol, maïs) | 4 saisons |
| 9 | derniers trocs (Léon avec le verger) ; pipistrelle ; étape 5 | 3 à 4 saisons |
| 10 à 11 | **N4** (16 000) ; derniers croisements (citrouille, chou) ; variétés croisées sauvées | 3 saisons |
| 11 à 13 | **N5** (25 000) ; V2 complet | — |

Le V3 (chantiers ≈ 175 000, terres sauvages ≈ 194 000) prend le relais à partir de l'an 10 : la Vallée complète vers
l'**an 18** pour le joueur tranquille (décision de l'utilisateur).

#### 16.12.3 D'où viendrait le revenu en plus (estimation, à mesurer)

| Source | Estimation (tranquille, 10 ans) |
|---|---|
| Traits des variétés du village et croisées semées (savoureuse, géante, généreuse…) | + 0,3 % |
| Parfumée (produits d'atelier + 15 %, sur les seules récoltes de variétés) | + 0,1 % |
| Étapes 3 à 5 un an plus tôt (pollinisation, sol vivant) | + 0,2 à + 0,4 % |
| Merle (4 trouvailles des haies), lézard (canicule), pipistrelle (équipe jamais lasse l'été) | + 0,3 % |
| Grainothèque N5 (touristes + 15 %) ; stand (+ 1 point) | + 0,1 % |
| N2 (3 graines par récolte), N5 (graines × 1) : moins de dépenses de semis | ≈ 0 sur le revenu (un peu de bénéfice) |
| **Total** | **≈ + 1 à + 1,5 %** (cible + 0 à + 4 %) |

#### 16.12.4 Cibles du V2 (`--compare-valley2` : V1 seul → V1 + V2, même graine ; 60 carrières × 10 ans, Détente, saisons de 7 jours ; `--years 14` et `--years 18` pour la traîne)

| Mesure | Cible |
|---|---|
| Tranquille : revenu sur 10 ans | **+ 0 à + 4 %** par rapport au V1 seul ; toute la Vallée ≤ + 8 % par rapport à sans |
| Tranquille : dépenses du V2 | 10 ans : **15 000 à 35 000** (N1 à N3 ou N4) ; 14 ans : ≈ 58 000 (Grainothèque complète) |
| Tranquille : rangs, Domaine | identiques **à un an près** (dépenses à 100 % au patrimoine ; achat de niveaux avec une réserve de charges) |
| Tranquille : argent en caisse à l'an 14 | **≤ 70 %** de ce qu'il serait sans la Vallée (cible d'ensemble du § 12.6 ; le V1 seul : 97 %) |
| Tranquille : nouveautés | **≥ 80 %** des saisons avec au moins une nouveauté (ans 2 à 10, médiane) ; **≥ 75 %** sur les seuls ans 6 à 10 |
| Tranquille : collection | 12 trocs entre l'an 8 et l'an 10 ; 11 croisements trouvés vers l'an 11 ; 35 variétés sauvées et N5 entre l'an 11 et l'an 13 ; 16 habitants vers l'an 12 |
| Tranquille : gestes par jour (ans 5 à 10) | + 0,3 à + 1 de plus que le V1 ; part des récoltes à la main ≥ 50 % |
| Débutant | rang 3 à l'an 5 dans ≥ 70 % (inchangé) ; à l'an 10 : ≥ 4 trocs et ≥ 1 croisement (médiane) |
| Appliqué | V2 complet vers l'an 8 ou 9 ; revenu ≤ + 6 % par rapport à sans la Vallée |
| Ferme laissée seule (`handsOff`, ans 4 à 7) | bénéfice **≤ + 3 %** par rapport à sans la Vallée |
| `automator` (aucun geste dès l'an 3) | **aucun troc, aucun croisement**, aucun habitant du V2 ; patrimoine à l'an 10 ≤ + 3 % |
| Part des semis (appliqué) | aucune culture ne gagne plus de 10 points de part |
| Carrière Classique, tranquille | faillites ≤ 20 % (inchangé) |
| Niveaux | **identiques** : `node tools/simulate.js` octet pour octet, parité 400 / 400 |

#### 16.12.5 Robots (par l'API publique et leur tirage propre `me.valleyRnd`, comme au V1)

- **Tranquille** : Grainothèque — un regard par saison : **N1** au rang ≥ 3 si l'argent − 2 000 > 2 saisons de charges +
  500 ; **N2** au rang ≥ 4 et **N3 à N5** au rang ≥ 5 si l'argent − prix > 4 saisons de charges (les aménagements de sa
  liste passent d'abord) ; troc en attente fait **70 %** des jours joués (une préférée ♥ une fois sur deux si possible,
  sinon la première variété sauvée) ; **sème la paire** au champ de départ avant ses autres graines anciennes quand il a
  des graines d'une variété du village dont le croisement n'est pas trouvé (achète la graine du pays si elle est sauvée) ;
  observe les habitants du V2 comme ceux du V1 (70 %) ; nichoir à chauves-souris dans sa liste après les berges.
- **Débutant** : 30 % de tout cela ; Grainothèque N1 et N2 seulement (au rang ≥ 4).
- **Appliqué** : tout, dès que possible (réserve de 4 saisons de charges), paires sur les champs tenus à la main ; plan de
  culture avec les variétés sauvées dont un trait paie la graine (savoureuse, précoce, géante, rustique, parfumée).
- **`automator`** : achète les niveaux (décision), ne fait aucun geste (ni troc, ni paire, ni observation).
- **`handsOff`, `idle`** : rien après leur dernière année jouée.
- Gestes : troc 2, semer la paire 1 par terrain, croisement (ouvrir le sachet) 0, observer 1 ; achat d'un niveau : 0
  (décision de boutique, comme les aménagements).

#### 16.12.6 Leviers si une cible n'est pas tenue (dans cet ordre)

Rencontres pour croiser (3 → 2 ou 4) ; cercles du troc (4 / 4 / 4 → 6 / 6 ou 3 / 3 / 3 / 3 avec N4) ; jour de la
proposition (une par saison → deux par saison avec N3) ; prix de la Grainothèque (× 0,8 à × 1,2, total entre 46 000 et
70 000) ; effets des niveaux (graines par récolte 3 → 2 ; fixation 5 → 6) ; recettes des habitants du V2. **Jamais** les
chiffres des niveaux, le rythme des rangs ni les tirages d'un flux existant.

#### 16.12.7 Résultats et réglages (livraison CORE V2, 2026-10-03)

Mesures : `node tools/simulate-career.js --compare-valley2 --runs 60 --years 14 --jobs 4` (Détente, saisons de 7 jours ;
**sans la Vallée → V1 seul → V1 + V2**, même graine ; robots du § 16.12.5 avec leur tirage propre `me.heritageRnd`) ;
`--years 18` pour la traîne ; `--difficulty classique` pour les faillites. Le simulateur des niveaux (`node
tools/simulate.js`) donne une sortie **identique octet pour octet** à celle d'avant le V2 ; `{ heritage: false }` donne
**exactement** l'état du V1 (empreinte d'une carrière de 10 ans, `tests/valley2-migration.test.js`).

**Réglages** (leviers du § 16.12.6 ; `src/data/career/heritage.js` fait foi) :

| Réglage | Départ | Réglé | Pourquoi |
|---|---|---|---|
| Prix de la Grainothèque | 2 000 / 5 000 / 10 000 / 16 000 / 25 000 (58 000) | **1 600 / 4 000 / 8 000 / 19 200 / 30 000 (62 800)** | les trois niveaux qui ouvrent les cercles du troc à × 0,8 (l'argent des ans 3 à 8 manque à la ferme : revenu − 1,5 % au départ) ; les deux niveaux « pour la beauté » à × 1,2 (argent en caisse à l'an 14 ≤ 70 % de sans la Vallée) |
| Planche d'essai récoltée par l'équipe | (règle du V1 : la graine est perdue) | **la graine revient** (V2) | sans cela, une variété du village (un seul troc) ou une croisée (un seul croisement) pouvait ne plus jamais se semer : 4 carrières sur 6 bloquées (citrouille et chou croisés, géants, récoltés par l'équipe) |
| Rencontres, cercles, jour du troc, effets des niveaux, recettes du V2 | — | inchangés | les cibles sont tenues sans eux (3 rencontres : décision de l'utilisateur) |

Robots (§ 16.12.5, précisions) : la Grainothèque au-delà du niveau 1 seulement si le prochain achat de la ferme (sa liste
d'envies) reste payable après elle **et** si l'argent couvre trois fois son prix (« la ferme d'abord », tranquille et
débutant ; l'appliqué : 4 saisons de charges seulement) ; une variété du village dont le croisement n'est pas trouvé garde
ses graines pour les paires ; les planches d'essai sont réparties entre les variétés (35 : la variété pas encore sauvée
qui pousse le moins d'abord) ; le débutant sème jusqu'à 2 paires par culture ; **le tranquille, avec la Grainothèque, met
au plan de culture ses variétés sauvées dont un trait paie la graine** (savoureuse, précoce, géante, rustique, parfumée —
une croisée avant la variété de sa culture), comme l'appliqué : sans cela, le V2 lui coûtait 1,5 % de revenu (les niveaux
payés pendant les ans de croissance, les paires de cultures peu chères), et l'étagère est justement faite pour montrer la
collection ; greffons de l'Api étoilé plantés au verger comme le Calville.

**Résultats** (60 carrières × 14 ans ; « V1 → V1 + V2 » sauf mention) :

| Mesure | Cible | Mesuré |
|---|---|---|
| Tranquille : revenu sur 10 ans | + 0 à + 4 % ; toute la Vallée ≤ + 8 % | **+ 1,7 %** (306 439 → 311 651) ; 14 ans : + 2,7 % ; toute la Vallée (sans → V1 + V2) **+ 4,9 %** |
| Tranquille : dépenses du V2 | 10 ans : 15 000 à 35 000 ; 14 ans ≈ 58 000 | **17 243** (N1 à N3) ; **63 291** à l'an 14 (Grainothèque complète + nichoirs) |
| Tranquille : rangs, Domaine | à un an près | rangs identiques chaque année ; Domaine **an 7** (V1 : an 7 ; sans la Vallée : an 8) |
| Tranquille : argent en caisse à l'an 14 | ≤ 70 % de sans la Vallée | **70 %** (128 285 / 183 344 ; V1 seul : 97 %) — tenu de justesse ; an 10 : 70 % |
| Tranquille : nouveautés | ≥ 80 % des saisons (ans 2-10) ; ≥ 75 % (ans 6-10) | **89 %** (97 % des carrières ≥ 80 % ; V1 : 65 %) ; ans 6-10 : **80 %** (V1 : 55 %) |
| Tranquille : collection | 12 trocs an 8-10 ; 11 croisements vers l'an 11 ; 35 variétés et N5 an 11-13 ; 16 habitants vers l'an 12 | 12 trocs **an 8** ; 11 croisements **an 10** ; N5 **an 12** ; 35 variétés **an 13** ; 16 habitants **an 11** ; **V2 complet an 13** |
| Tranquille : gestes par jour (ans 5-10) ; part à la main | + 0,3 à + 1 ; ≥ 50 % | **+ 0,5** (8,35 → 8,85) ; **91 %** |
| Débutant | rang 3 à l'an 5 ≥ 70 % ; à l'an 10 : ≥ 4 trocs, ≥ 1 croisement (médiane) | **98 %** (inchangé) ; **10 trocs**, **1 croisement** (55 % des carrières) ; revenu − 0,1 % |
| Appliqué | V2 complet vers l'an 8 ou 9 ; revenu ≤ + 6 % par rapport à sans la Vallée | V2 complet **an 9** ; revenu **− 2,1 %** (il achète toute la Grainothèque dès qu'il peut) |
| Ferme laissée seule (ans 4 à 7) | bénéfice ≤ + 3 % par rapport à sans la Vallée | **− 3,8 %** (N1 achetée l'an 3) |
| `automator` | aucun troc, croisement ni habitant du V2 ; patrimoine an 10 ≤ + 3 % | **aucun après l'an 2** (4 trocs les ans 1 et 2, quand il joue encore, comme les habitants du V1) ; 0 habitant du V2 ; patrimoine **− 4,9 %** |
| Part des semis (appliqué) | aucune culture + 10 points | écart le plus grand **1,6 point** (maïs) |
| Étape 5 « La vallée chante » (tranquille) | « environ un an plus tôt » (vers l'an 9) | livraison CORE : **an 6** (paliers du V1) ; **après recalage des paliers (intégration) : an 9** (V1 : an 11) — étapes 1 à 5 aux ans 2 / 3 / 4 / 6 / 9 (V1 seul : 2 / 3 / 4 / 6 / 11) ; débutant inchangé (3 / 6 / 13 / — / —) ; appliqué an 5 (V1 : an 8) ; revenu, rangs, argent en caisse inchangés à 0,1 % près |
| Carrière Classique, tranquille (30 × 10 ans) | faillites ≤ 20 % | **0 %** ; revenu − 0,2 % ; nouveautés 92 % ; 12 trocs an 9, 9 croisements à l'an 10 |
| Traîne (60 × 18 ans) | — | tranquille : revenu sur 18 ans **+ 2,7 %** ; argent en caisse à l'an 18 : 88 % de sans la Vallée (le V3 prendra le relais) ; dépenses du V2 63 295 |
| Niveaux | identiques | `node tools/simulate.js` **identique octet pour octet** ; parité 400 / 400 |

**Intégration et vérification (2026-10-03)** — `node tools/simulate-career.js --compare-valley2 --runs 60 --years 14
--jobs 4`, avant → après le recalage des paliers des étapes (le simulateur affiche maintenant l'année de chaque étape et
les signes de vie par an) :

| Mesure (médianes, 60 × 14 ans) | Avant (paliers du V1) | Après (2 / 6 / 11 / 22 / 38) |
|---|---|---|
| Tranquille : étapes 1-5 (an) | 2 / 3 / 4 / 5 / 6 | **2 / 3 / 4 / 6 / 9** (V1 seul : 2 / 3 / 4 / 6 / 11) |
| Tranquille : signes de vie en fin d'année (ans 1 à 14) | 0 · 4,5 · 8 · 14 · 20 · 27 · 31 · 35 · 39,5 · 43 · 47 · 50 · 51 · 51 | identiques |
| Débutant : étapes 1-5 | 3 / 6 / 13 / — / — | 3 / 6 / 13 / — / — (inchangé) |
| Appliqué : étapes 1-5 | 1 / 2 / 3 / 3 / 4 | 1 / 2 / 3 / 4 / 5 (V1 seul : 1 / 2 / 3 / 4 / 8) |
| Tranquille : revenu 10 ans (V1 → V1 + V2) | + 1,7 % | + 1,7 % |
| Tranquille : argent en caisse an 14 (de sans la Vallée) | 70 % | 70 % |
| Tranquille : nouveautés (ans 2-10 ; carrières ≥ 80 %) | 89 % ; 97 % | 89 % ; 98 % |
| Toutes les autres lignes (rangs, Domaine, dépenses du V2, collection, `handsOff`, `automator`, part des semis) | — | identiques |

`node tools/capture-parity.js --check` : parité exacte, 400 / 400 ; `node tools/simulate.js` : sortie identique octet pour
octet à celle d'avant le V2 (commit `090ec5c`).

### 16.13 Cas limites

| Cas | Ce qui se passe |
|---|---|
| Aucune variété sauvée | Pas de proposition de troc (ni foire ni saison) ; la fiche dit « Sauvez une première variété pour échanger ». |
| Troc en attente depuis des saisons | Il attend (aucun rappel, aucune expiration) ; aucune autre proposition tant qu'il attend. |
| Toutes les variétés sauvées sont celle du voisin | Impossible : la sienne n'est pas encore chez vous avant le troc. |
| Léon sans verger | Il est passé dans l'ordre ; il propose dès qu'un verger existe ; la grille du troc dit « Il faut un verger ». |
| Grainothèque jamais construite | Un troc par an (foire) ; croisements possibles ; niveaux 2 à 5 jamais : rien n'est bloqué pour toujours. |
| Ancienne carrière riche (rang 6, an 14) reprise | Panneau et récit `heritage0` à la première aube ; elle peut acheter les 5 niveaux d'un coup (son choix) ; les cercles s'ouvrent, mais toujours **un troc par saison** ; rien de rétroactif. |
| Parents voisins tous deux mûrs | Récolter l'un compte une rencontre ; l'autre, récolté ensuite, compte aussi si on a resemé un parent à côté entre-temps. |
| Parcelle entourée de plusieurs parents | Une seule rencontre par récolte. |
| Variété croisée à côté d'un parent | Rien (pas de génération suivante au V2). |
| Planche de croisement gelée ou pourrie | La graine revient (règle du V1) ; les rencontres déjà faites restent. |
| Récolte de l'équipe ou d'une machine | Jamais de rencontre, jamais de graine (F1). |
| Croisement trouvé alors que ses graines du village manquent | Sans importance : la croisée est une variété à part. |
| Nom de ferme sans article (« Chez Martin ») | « Tomate de Chez Martin » (règle `ofFarm`). |
| Serre de 4 parcelles sur une ligne | Les voisines sont à gauche et à droite seulement. |
| Tableau du village désactivé (test) | Le troc reste dans la Grainothèque et la ligne « À faire ». |
| Fêtes du lot 4 désactivées | Le troc de la foire apparaît quand même le dernier jour d'hiver (comme l'étal du V1). |
| Saisons de 10 ou 14 jours | Rien n'est compté en jours : proposition au 2ᵉ jour, dernier jour d'hiver, rencontres comptées par récolte. |
| `createCareer({ valley: { heritage: false } })` | V1 seul, exactement : aucun tirage `valley2`, aucun champ V2 utilisé. |

### 16.14 Ce qui change par rapport à l'aperçu du § 11.2

| Aperçu | Conception V2 | Pourquoi |
|---|---|---|
| Grainothèque sur un emplacement de pré, de basse-cour ou de cour des ateliers (`build(lotId, slot, 'seedLibrary')`) | Emplacement **réservé dans la bande de la maison** ; ouvrage de la Vallée, pas un bâtiment de `BUILDINGS` | Rien ne peut la bloquer (emplacements pleins) ; 100 % au patrimoine sans exception |
| Croisement : 15 % de chances par récolte du même jour (+ 5 points bourdons, osmie, N4 ; 30 % au plus), 1 graine | **3 rencontres** déterministes (2 au N4, double avec l'osmie), sachet de **3 graines** | « Rien d'aléatoire frustrant » ; barre lisible ; une graine seule se perdait trop vite en planche d'essai |
| Les deux parcelles récoltées à la main le même jour | Récolter **l'une** à la main pendant que l'autre pousse à côté | Un seul geste ; marche quand les durées de pousse diffèrent |
| Troc à la foire puis « toute l'année » avec N1 | Foire chaque année + **une proposition par saison** avec la Grainothèque, voisins ouverts par **cercles** (niveaux 1 à 3) | Étale les 12 trocs sur les ans 4 à 9 (le creux de nouveautés) |
| N1 troc et croisements ; N2 + 1 graine ; N3 fixation en 5 ; N4 croisement + 5 points ; N5 graines × 1 et touristes + 15 % | Mêmes prix et presque mêmes effets ; N1 à N3 ouvrent aussi les cercles du troc ; N4 : croisement en 2 rencontres | Cohérent avec les croisements déterministes |
| Navet long des Vertus ; Reinette grise du Canada pour Léon | **Navet des Vertus Marteau (†)** ; **Pomme Api étoilé (†)** | Nom exact de la variété ; la Reinette grise reste au verger conservatoire du V3 |
| Merle « 4 haies » ; lézard « 2 tas de pierres » ; abeille sauvage « hôtel + 3 coins fleuris » ; pipistrelle « équipe joyeuse les soirs d'été » | Merle **d'hiver**, 6 haies + un arbre adulte ; lézard 3 tas + friche ou jachère ; osmie **au printemps**, 2 hôtels + 3 coins fleuris ; pipistrelle : **équipe jamais lasse l'été** | Un habitant d'hiver et un de printemps pour le creux ; recettes un peu plus tardives ; service sans gain de production pour une ferme automatisée |
| Comice : « Présenter N variétés anciennes » ; Joseph : une quête « variété ancienne » par an | **Écartés** au V2 ; Joseph raconte 4 récits | Les épreuves du comice et le choix des quêtes passent par des flux existants (`events`) : un modèle de plus changerait leurs tirages ; le stand garde son lien (+ 1 point) |
| « Trait en double → un troisième » | Inutile : traits du village toujours différents de ceux du pays | Table fixe |

### 16.15 Points à trancher (recommandation en premier)

1. **Emplacement de la Grainothèque** : (a) emplacement réservé dans la bande de la maison (recommandé : jamais bloquée,
   toujours visible en bas de la ferme) ; (b) un emplacement de bâtiment de pré, de basse-cour ou de cour des ateliers,
   comme l'aperçu (le joueur choisit, mais un emplacement d'abri en moins) ; (c) la boîte en fer du perron grandit et devient
   la Grainothèque sur place (très lisible, mais place comptée près de la porte).
2. **Les croisements** : (a) déterministes, 3 rencontres, barre visible (recommandé) ; (b) une chance par rencontre (15 %)
   avec une garantie à la 5ᵉ rencontre (un peu de surprise) ; (c) une seule rencontre suffit (immédiat, moins de jeu).
3. **Rythme du troc** : (a) une proposition par saison, voisins ouverts par cercles avec les niveaux 1 à 3 (recommandé :
   comble les ans 4 à 9) ; (b) une par saison, les 12 voisins dès le niveau 1 (≈ 3 ans, fini vers l'an 7) ; (c) tous ouverts
   au choix du joueur (rapide, mais plus rien à attendre après un an).
4. **Signes de vie du V2 pour les étapes 1 à 5** : (a) ils comptent (recommandé : étape 5 un an plus tôt, le V3 compte sur ce
   total) ; (b) seulement pour les étapes du V3 (étape 5 vers l'an 11 comme au V1).
5. **Liens écartés** (comice, quête de Joseph) : (a) écartés au V2, Joseph raconte 4 récits (recommandé : aucun flux
   existant ne bouge) ; (b) une quête « variété ancienne » par an (tirages du flux `events` changés pour les carrières avec
   la Vallée).
6. **Nom des variétés croisées** : (a) « Tomate de la Ferme des Tilleuls » (recommandé) ; (b) court : « Tomate des
   Tilleuls » ; (c) le joueur baptise chaque croisée (clavier sur téléphone, plus de texte).

## Décisions de l'utilisateur sur le V2 (2026-10-03)

1. Grainothèque : **emplacement réservé près de la maison** (jamais bloquée, ne prend pas la place d'un abri).
2. Croisements : **déterministes, 3 rencontres**, avec une barre visible.
3. Troc : **progressif**, un par saison, voisins ouverts par groupes de 4 avec les niveaux 1 à 3.
4. Nom des variétés croisées : **nom complet** (« Tomate de la Ferme des Tilleuls »).

Points non posés, tranchés selon la recommandation (§ 16.15) : les signes de vie du V2 comptent pour les étapes 1 à 5 ; comice et quête de Joseph écartés (aucun flux existant ne bouge).

---

## 17. Lot V3 « Le ruisseau » — conception détaillée (2026-10-03)

Conception complète du lot V3 ; elle **remplace l'aperçu du § 11.3** partout où les deux diffèrent (écarts listés au
§ 17.15). Contrats de code : `docs/ARCHITECTURE.md`, « Vallée vivante — contrats du lot V3 ». Résumé : `docs/GAME_DESIGN.md`
§ 18.2. Décisions de l'utilisateur déjà prises et suivies ici : lieux = **chantier payé + condition de vie + temps de
reprise** ; restauration complète **vers l'an 18** pour le joueur tranquille ; **terres sauvages au V3, après les 16
terrains** ; dépenses de la Vallée comptées **à 100 %** au patrimoine. Comme aux V1 et V2, les chiffres sont des **valeurs
de départ** réglées ensuite par `tools/simulate-career.js --compare-valley3` ; la version qui fait foi vivra dans
`src/data/career/places.js`.

### 17.0 En bref

**L'idée.** La ferme est devenue un paysage vivant ; il reste **la vallée autour**. Au soir où « La vallée chante »
(étape 5), Joseph emmène le joueur **sur la colline** : d'en haut, on voit le Ru des Saules à sec, le bois coupé, l'étang
envasé, les talus nus du chemin creux, la prairie grillée, le vieux verger de la commune. Six lieux à rendre à la vie,
chacun en plusieurs étapes : le joueur **paie le chantier** (l'argent dormant de la ferme), mais le lieu ne repart que si
**la ferme lui en donne les moyens** (des haies pour retenir l'eau, des bêtes installées pour repeupler) et il **reprend
lentement**, sous les yeux, en une à quatre saisons. Puis, une fois les 16 terrains achetés, les forêts qui restent autour
de la ferme peuvent être **rendues à la nature** : un bois, un marais, une prairie sauvage, qui ne produisent rien.

**En une phrase de jeu.** Le joueur ouvre **la vue de la vallée** (un grand dessin en portrait qu'on fait défiler au
doigt), touche un lieu, lit ce qui lui manque (« ✓ 8 haies · ✗ le martin-pêcheur »), **lance le chantier** d'un geste,
regarde le lieu reprendre (barre « encore 1 saison »), puis **va voir** les bêtes de la vallée qui reviennent (il faut les
toucher, comme sur la ferme), pêche au ruisseau, cueille les champignons du bois ; l'étape d'après demande souvent ces
nouveaux habitants : la vallée avance au rythme de la vie, pas seulement de l'argent.

**Ce que ça résout.**

| Problème (V2, § 16.12.7 et trace `--seed 3 --strategy casual --years 18`) | Réponse du V3 |
|---|---|
| L'argent s'entasse à nouveau après la Grainothèque : **128 000 en caisse à l'an 14** (médiane ; 70 % de sans la Vallée), **≈ 290 000 à l'an 18**, bénéfice + 42 000 à + 52 000 par an des ans 13 à 18 | **≈ 251 000** pièces de puits « pour la vie » : 19 chantiers (**160 000**) et 18 terres sauvages (**90 900**), 100 % au patrimoine ; argent en caisse visé **≈ 55 000 à l'an 14** et **≈ 45 000 à l'an 18** |
| Plus aucune nouveauté de la Vallée après l'an 13 (V2 complet) | Une nouveauté presque chaque saison des ans 9 à 18 : chantier, lieu qui reprend, habitant de la vallée, récit, pêche, champignons, terre qui reprend |
| La ferme est finie, le monde s'arrête à sa lisière | Un **écran nouveau** (la vallée vue d'en haut, la ferme petite au milieu) et une carte qui continue de changer après le 16ᵉ terrain |
| L'aperçu du § 11.3 demandait 369 000 (175 000 + 194 000) : intenable vers l'an 18 (le joueur tranquille dispose de ≈ 290 000 de l'an 9 à l'an 18, réserve comprise) | Puits recalé à **≈ 251 000** (§ 17.12.2) ; point à trancher au § 17.16 |

**Règles d'or du V3** (en plus de celles du § 0 et du § 16.0) :

1. **Chantier + condition + reprise**, toujours les trois. Le chantier se paie d'un geste ; il ne se lance que si la
   condition de vie est remplie ; l'étape n'est atteinte qu'au bout de la reprise (comptée en saisons, visible).
2. **Rien ne se perd, rien n'expire** : une étape atteinte reste ; une reprise commencée va à son terme (même si la
   condition n'est plus remplie) ; une bête de la vallée venue attend qu'on la voie, sans limite ; une terre sauvage reste
   sauvage. Aucun entretien, aucun recul, aucune échéance.
3. **Le joueur au centre** : ouvrir la vue, lancer un chantier, observer une bête de la vallée, pêcher au ruisseau,
   cueillir un champignon, confier une forêt — jamais l'équipe ni les machines. Les étapes qui demandent un habitant de la
   vallée **attendent que le joueur l'ait touché** : une vallée ne se restaure pas sans fermier.
4. **Aucune envie fabriquée** : aucune ligne « À faire » pour pousser à payer un chantier ; le prochain indice ne propose
   un chantier que s'il est payable en gardant deux saisons de charges.
5. **Carrière seulement, niveaux identiques** : rien en partie de niveau (Détente comme Classique), parité 400 / 400,
   `node tools/simulate.js` identique octet pour octet ; seules deux pages d'album nouvelles se voient dans la grange (« À
   découvrir dans Ma ferme »).
6. **Un seul flux nouveau, `valley3`** ; `valley`, `valley2`, `orders`, `variety`, `events`, `cozy`, `quality`,
   `surprise`, `sky`, `staff`, `career`, météo et marché tirent exactement les mêmes nombres qu'avant (la 2ᵉ pêche du jour
   tire sur `valley3`, pas sur `events`).

### 17.1 La boucle de jeu du V3

| Échelle | Ce que fait le joueur (de ses mains) |
|---|---|
| Quelques secondes | Toucher le poteau « Vers la vallée » ; toucher un lieu → sa fiche ; « Lancer le chantier · 7 000 » ; toucher le martin-pêcheur qui attend au ruisseau ; pêcher au ponton ; cueillir un cèpe. |
| Une journée | Lire ce qui manque à un lieu (« Il manque le martin-pêcheur ») ; poser deux haies de plus sur la ferme pour le ruisseau ; une pêche au ruisseau. |
| Une saison | Un chantier ; un lieu qui reprend (fondu, « Le ruisseau chante ! ») ; un habitant de la vallée ; les champignons de l'automne. |
| Une année | Deux à quatre étapes de lieux ; un récit de Joseph ; une étape de la vallée de temps en temps ; (après le 16ᵉ terrain) trois à six terres sauvages. |
| Plusieurs années | V3 complet (6 lieux à leur dernière étape, 10 habitants de la vallée, 18 terres sauvages, étape 7) **vers l'an 18** pour le joueur tranquille ; l'appliqué vers l'an 13 à 14. |

Session type (an 13, automne) : « En bas de la ferme, le poteau "Vers la vallée". Je le touche : la vallée en automne, les
feuilles rousses du bois de la Combe. Un "?" au bord du ruisseau : un martin-pêcheur ! Je le touche, il s'installe. Le
ruisseau peut maintenant passer à "Les truites reviennent" : ✓ le bois à l'étape 1, ✓ le martin-pêcheur. 13 000 : je
lance le chantier, deux saisons de reprise. Avant de rentrer, je pêche au ponton (un chevesne, 14 pièces) et je cueille
deux girolles dans le bois. »

### 17.2 Le récit : « Sur la colline »

À la **première aube où la vallée est à l'étape 5** (« La vallée chante ») avec le V3 ouvert, Joseph raconte « Sur la
colline » (récit `hill`, vignette `story.hill` : Joseph et le fermier assis dans l'herbe, la vallée grise en dessous) :

> « Viens, monte avec moi sur la colline. »
> « D'ici, on voit toute la vallée : le ruisseau à sec, le bois coupé, l'étang plein de vase. »
> « Ta ferme est là, au milieu. Et si on rendait la vallée à la vie ? »

« Merci, Joseph » → un **poteau de bois « Vers la vallée »** se plante au bord de la route, en bas à droite de la ferme
(scène) ; la fiche « La Vallée » reçoit son 4ᵉ segment, **Lieux** ; la vue de la vallée s'ouvre une première fois (conseil
« première fois » `valley.view`). Une carrière déjà à l'étape 5 au moment de la mise à jour reçoit le récit à la première
aube (rien de rétroactif).

**Hélène, la naturaliste.** Au premier habitant de la vallée installé, Joseph présente Hélène (récit `helene`, vignette
`story.helene` : une dame en ciré, jumelles au cou, carnet à la main) : « Je te présente Hélène : elle compte les oiseaux
depuis quarante ans. » · « Elle dit qu'un martin-pêcheur ici, c'est un petit miracle. » · « Elle tient le carnet de la
vallée : elle y notera chaque bête qui revient. » La page d'album des habitants de la vallée s'appelle « Le carnet
d'Hélène ». Hélène se promène ensuite parfois dans la vue (décor, jumelles levées), sans rien demander.

### 17.3 La vue de la vallée (écran à part, portrait)

**Ouvrir.** Par le **poteau « Vers la vallée »** (scène, en bas de la ferme : cible ≥ 48 px), le bouton « Voir la vallée »
du segment **Lieux** de la fiche « La Vallée », la ligne « À faire » (une bête de la vallée qui attend, des champignons),
le prochain indice, un message (« Le ruisseau chante ! » → « Voir »). **Le temps s'arrête** pendant la vue (comme pendant la
lecture d'une fiche) ; « ‹ La ferme » ramène à la ferme, là où l'on était.

**Le dessin.** Un panorama vertical (monde de **192 × 432 px**, tuiles de 16 px ; zoom entier qui remplit la largeur : × 5
sur le Pixel 7 et sur 360 × 740, marges latérales prolongées par le bord du dessin), qu'on fait défiler au doigt de haut
en bas (élan léger ; pas de pincement : le dessin est déjà à la bonne taille). De haut (le loin) en bas (le près) :

```
 y (px monde)  ┌──────────────── 192 ────────────────┐
   0 –  40     │ ciel, collines bleues, vol d'oiseaux │   (oiseaux : étape ≥ 6 ; brume du matin : étape ≥ 6)
  40 – 150     │ LE BOIS DE      │ LE VERGER          │   bois 96 × 96 en haut à gauche (source du ruisseau) ;
               │ LA COMBE        │ CONSERVATOIRE      │   verger 80 × 80 sur le coteau, à droite
 150 – 250     │ L'ÉTANG DU      │ LA PRAIRIE DES     │   étang 80 × 64 + moulin 32 × 48 sur sa rive droite ;
               │ MOULIN  ⚙       │ COQUELICOTS        │   prairie 80 × 80
 250 – 310     │      ~  [ LA FERME 48 × 48 ]         │   la ferme en petit (4 dessins selon sa taille)
 310 – 400     │ LE BOCAGE DU CHEMIN CREUX (192 × 64) │   haies, talus, têtards
 400 – 432     │ le chemin vers le village, clocher   │
               └──────────────────────────────────────┘
   LE RU DES SAULES : un ruban (64 × 312) qui descend de la source du bois (y 120) jusqu'en bas à gauche,
   passe devant l'étang et sous le pont du chemin creux ; le ponton de pêche est à côté de l'étang.
```

- Chaque lieu est **dessiné dans chacun de ses états** (§ 17.4 : 4 états, 5 pour le ruisseau) ; pendant une reprise, il
  porte le **panneau de chantier** (piquets, brouette, « Chantier de la vallée ») et des pousses vertes qui apparaissent au
  fil de la reprise ; à l'arrivée, fondu de 1,2 s vers le nouvel état et étincelles (mouvements réduits : changement
  direct). Les saisons sont celles de la ferme (fond dessiné par saison, lieux teintés par le code comme les planches de
  saison, givre posé par le code l'hiver).
- **Cibles** (coordonnées écran) : chaque lieu ≥ 100 × 100 px CSS au zoom × 5 (le plus petit, l'étang : 152 × 122 sur le Pixel 7, 133 × 107 sur 360 × 740) ; une bête qui attend (« ? ») ≥ 48 px ; un
  champignon ≥ 48 px ; le ponton ≥ 48 px ; la ferme (retour) ≥ 48 px. Toucher un lieu → sa fiche (feuille basse, la vue
  reste visible au-dessus et défile pour garder le lieu en vue).
- **Barre du bas** (≥ 64 px, safe-area) : « ‹ La ferme » (≥ 56 px, à gauche) · au centre « 7 / 19 étapes · 62 signes de vie »
  (14 px) · « Liste » (≥ 48 px, à droite) qui ouvre la **liste des lieux** (feuille basse : 6 lignes ≥ 72 px — icône, nom,
  « Étape 2 / 4 », état « en reprise · encore 3 jours » / « prêt · 7 000 » / « attend : le martin-pêcheur ») : la vue se lit
  aussi sans le dessin (lecteurs d'écran, petit écran, texte à 150 %). En haut, un ruban fin « La vallée · Étape 6 · L'eau
  revient » (14 px, sous la safe-area). Rien d'autre à l'écran.
- **Vivant, sans rien demander** : l'eau qui coule (2 images ; mouvements réduits : fixe), les habitants installés qui
  passent (hachage pur du jour, 4 dessinés au plus), Hélène parfois, Joseph assis sur le banc du belvédère quand un récit
  l'attend (le toucher ouvre le récit).

**Maquette (412 × 915, haut de la vue).**

```
┌──────────────────────────────────────┐
│ La vallée · Étape 6 · L'eau revient  │  ruban 14 px
│ ┌──────────────┬───────────────────┐ │
│ │  [bois de la │ [verger : arbres  │ │
│ │  Combe, jeu- │  taillés, étiquet-│ │
│ │  nes plants] │  tes] ⛏ chantier  │ │
│ ├──────────────┼───────────────────┤ │
│ │ [étang, eau  │ [prairie fleurie, │ │
│ │  claire] ⚙   │  coquelicots]     │ │
│ │  ? ← martin  │                   │ │
│ │ ~~~ruisseau~ │    [ferme]        │ │
│ └──────────────┴───────────────────┘ │
│ ‹ La ferme   7 / 19 · 62 signes  Liste│  barre du bas ≥ 64 px
└──────────────────────────────────────┘
```

### 17.4 Les six lieux de la vallée

Chaque lieu a **une étape 0** (l'état d'aujourd'hui, dessiné) et **3 étapes** à rendre (le ruisseau : 4). *(Réglage CORE V3 : les reprises des tableaux ci-dessous, 1 / 2 / 4 saisons, sont devenues **2 / 3 / 4** — Ru des Saules 2 / 2 / 3 / 3 —, § 17.12.8.)* Une étape =
**chantier** (pièces, d'un geste) + **condition de vie** (lue en lignes cochées) + **reprise** (en saisons : une saison =
la durée des saisons de la carrière, 7, 10 ou 14 jours ; décompte visible). Un lieu ne fait qu'**un chantier à la fois** ;
les six lieux peuvent reprendre en même temps. Chaque ligne de Joseph (≤ 110 caractères) se lit dans la fiche du lieu.

#### 17.4.1 Le Ru des Saules (`brook`) — le ruisseau de la 3ᵉ veillée

| Étape | Nom | Chantier | Condition de vie | Reprise | Ce que la ferme y gagne | Joseph |
|---|---|---|---|---|---|---|
| 0 | À sec | — | — | — | — | « Un lit de cailloux blancs. Petit, j'y attrapais les truites à la main. » |
| 1 | Un filet d'eau | **3 500** | **8 haies** sur la ferme (« les haies retiennent l'eau ») | 1 saison | **Canicule** : une parcelle non arrosée pousse **½ jour** (au lieu de ¼ ; Classique : ¼ au lieu de 0) | « Les haies retiennent la pluie : l'eau revient doucement au ruisseau. » |
| 2 | Le ruisseau chante | **7 000** | **4 jachères fleuries** semées (en tout, depuis le début) | 1 saison | **Pêche au ruisseau** : une pêche par jour au ponton, **en plus** de celle de la mare (sans mare aussi) | « Écoute-le courir sur les cailloux. Ça faisait soixante ans. » |
| 3 | Les truites reviennent | **13 000** | le **bois de la Combe à l'étape 1** et le **martin-pêcheur** installé | 2 saisons | La pêche du ruisseau prend aussi **truites et écrevisses** (§ 17.5) | « L'ombre des jeunes arbres garde l'eau fraîche : les truites aiment ça. » |
| 4 | Le moulin tourne | **22 000** | l'**étang du moulin à l'étape 2** et les **écrevisses** installées | 2 saisons | **Moulin à eau** : le moulin de la ferme (atelier) a **une place de plus** (sans moulin : la roue tourne pour la beauté, la fiche le dit) | « La vieille roue tourne de nouveau. Mon père y portait le blé. » |

Total : **45 500**. Habitants : martin-pêcheur (étape 2), écrevisses (étape 3), loutre (étape 4).

#### 17.4.2 Le bois de la Combe (`combe`)

| Étape | Nom | Chantier | Condition de vie | Reprise | Ce que la ferme y gagne | Joseph |
|---|---|---|---|---|---|---|
| 0 | La coupe rase | — | — | — | — | « Des souches et des ronces. On a tout coupé, il y a longtemps. » |
| 1 | Jeunes plants | **3 000** | le **geai des chênes** installé (« ses glands ont levé ») | 1 saison | **Bois mort** : chauffage de la serre **− 50 %** | « Les glands que ton geai a cachés ont levé. On les aide un peu. » |
| 2 | Le bois clair | **6 500** | l'**écureuil roux** et le **pic noir** installés | 2 saisons | **Champignons d'automne** à cueillir dans la vue (§ 17.5) | « Le soleil passe entre les branches : les champignons vont sortir. » |
| 3 | La vieille futaie | **12 000** | la **chouette hulotte** et le **chevreuil** installés | 4 saisons | **Lisière d'hiver** : **une trouvaille de plus** à la fois (5 avec le rouge-gorge, 4 sans) | « De grands arbres, enfin. Ici, on parle tout bas. » |

Total : **21 500**. Habitants : pic noir (étape 1), chevreuil (étape 2), salamandre (étape 3).

#### 17.4.3 La prairie des Coquelicots (`poppies`)

| Étape | Nom | Chantier | Condition de vie | Reprise | Ce que la ferme y gagne | Joseph |
|---|---|---|---|---|---|---|
| 0 | La friche sèche | — | — | — | — | « De l'herbe jaune et des cailloux. Même les sauterelles s'ennuient. » |
| 1 | La prairie | **2 000** | **3 bandes fleuries** sur la ferme | 1 saison | **Foin** : entretien des animaux **− 10 %** | « Les graines de tes bandes fleuries ont volé jusqu'ici. » |
| 2 | La prairie fleurie | **5 000** | les **bourdons**, le **paon-du-jour** et l'**alouette** installés | 2 saisons | Chaque **ruche + 1 pièce par jour** (hors hiver ; s'ajoute au trait mellifère) | « Des coquelicots à perte de vue, comme sur la boîte de ma mère. » |
| 3 | La prairie aux orchidées | **10 000** | l'**osmie** et la **huppe** installées | 4 saisons | **Sol vivant** : après une jachère fleurie, la culture suivante pousse **+ 30 %** (au lieu de + 20 %) | « Des orchidées sauvages ! Il faut des années sans charrue pour ça. » |

Total : **17 000**. Habitants : alouette (étape 1), huppe (étape 2).

#### 17.4.4 L'étang du moulin (`millpond`)

| Étape | Nom | Chantier | Condition de vie | Reprise | Ce que la ferme y gagne | Joseph |
|---|---|---|---|---|---|---|
| 0 | La vase | — | — | — | — | « Une cuvette de boue et de roseaux secs. Le moulin dort à côté. » |
| 1 | L'étang | **5 500** | le **Ru des Saules à l'étape 2** | 1 saison | **Poissons + 15 %** (pêche de la mare et du ruisseau) | « Le ruisseau a rempli la cuvette. Le héron est déjà là, regarde. » |
| 2 | Les nénuphars | **11 000** | les **libellules**, la **grenouille rousse** et le **héron** installés | 2 saisons | **Touristes + 10 %** (les promeneurs du dimanche) | « Des nénuphars blancs. Le dimanche, le village vient s'y promener. » |
| 3 | La roselière | **18 000** | la **pipistrelle** installée | 4 saisons | Abris **+ 5 %** au printemps et en été (les hirondelles chassent sur les roseaux ; s'ajoute aux hirondelles) | « Les roseaux ont tout gagné : les hirondelles y chassent tout l'été. » |

Total : **34 500**. Habitant : héron cendré (étape 1). Visiteurs : promeneurs du village (étape 2, décor).

#### 17.4.5 Le bocage du chemin creux (`bocage`)

| Étape | Nom | Chantier | Condition de vie | Reprise | Ce que la ferme y gagne | Joseph |
|---|---|---|---|---|---|---|
| 0 | Les talus nus | — | — | — | — | « Le chemin creux, sans une haie. Le vent emporte tout. » |
| 1 | Les haies replantées | **2 500** | **12 haies** sur la ferme | 1 saison | **Cueillette des haies** : pièces **× 1,5** | « Tes haies ont fait des petits : on a replanté tout le chemin. » |
| 2 | Le bocage | **5 500** | le **hérisson**, le **rouge-gorge** et le **merle** installés | 2 saisons | Corbeaux **encore deux fois plus rares** | « Des haies, des talus : la vallée a retrouvé ses chemins de traverse. » |
| 3 | Les vieux têtards | **11 000** | la **chouette chevêche** installée | 4 saisons | **Plus aucun corbeau** ; cueillette des haies **× 2** (au lieu de × 1,5) | « Les vieux saules en têtard : la chevêche y dort, les corbeaux n'osent plus. » |

Total : **19 000**. Habitant : chouette chevêche (étape 2).

#### 17.4.6 Le verger conservatoire (`oldOrchard`) — le vieux verger de la commune

| Étape | Nom | Chantier | Condition de vie | Reprise | Ce que la ferme y gagne | Joseph |
|---|---|---|---|---|---|---|
| 0 | Les pommiers abandonnés | — | — | — | — | « Le vieux verger de la commune. Plus personne ne le taille. » |
| 1 | Taillés et greffés | **3 000** | la **Pomme Calville blanc d'hiver sauvée** | 1 saison | **3 greffons de Reinette grise du Canada** (†) : une variété ancienne de plus à sauver (§ 17.6) | « On a taillé, greffé : voilà trois greffons de Reinette grise pour toi. » |
| 2 | En fleurs | **6 500** | la **Pomme Api étoilé sauvée** (le greffon de Léon) | 2 saisons | **Cerisier Montmorency** (†) : jeunes plants à planter dans vos vergers (§ 17.6) | « Tout le verger en fleurs. Et un vieux cerisier Montmorency, encore là ! » |
| 3 | Le conservatoire | **13 000** | **6 arbres fruitiers adultes** dans vos vergers | 4 saisons | **Poirier Louise-Bonne** (†) : jeunes plants à planter dans vos vergers | « Chaque vieil arbre a son étiquette. Et voilà un poirier Louise-Bonne. » |

Total : **22 500**. Pas d'habitant (le verger accueille les enfants de l'école à l'étape 3 : décor).

**Total des chantiers : 160 000** (19 étapes). Récapitulatif des effets : **tous modestes**, chacun sur un levier qui
existe déjà (pousse en canicule, pêche, places du moulin, chauffage, entretien, ruches, jachère, touristes, abris,
corbeaux, cueillette des haies, trouvailles d'hiver, arbres du verger) : aucune mécanique de service nouvelle.

**Les chaînes** (ce qui attend quoi) — lisibles dans la fiche de chaque lieu, jamais cachées :

```
haies ×8 ─► Ru 1 ─► jachères ×4 ─► Ru 2 ─┬─► Étang 1 ─► (libellules, grenouille, héron) ─► Étang 2 ─► (pipistrelle) ─► Étang 3
                                         └─► martin-pêcheur ─┐
geai ─► Bois 1 ─► (écureuil, pic noir) ─► Bois 2 ─► (chouette, chevreuil) ─► Bois 3
          └──────────────────────────────────────────────────┴─► Ru 3 ─► écrevisses ─┐
                                                                        Étang 2 ─────┴─► Ru 4
bandes ×3 ─► Prairie 1 ─► (bourdons, paon-du-jour, alouette) ─► Prairie 2 ─► (osmie, huppe) ─► Prairie 3
haies ×12 ─► Bocage 1 ─► (hérisson, rouge-gorge, merle) ─► Bocage 2 ─► (chevêche) ─► Bocage 3
Calville sauvée ─► Verger 1 ─► Api étoilé sauvée ─► Verger 2 ─► 6 arbres adultes ─► Verger 3
```

Ce qu'il faut sur la ferme pour tout restaurer : la mare (libellules, grenouille, pipistrelle), un verger (écureuil,
Calville, Api), le grenier (chouette hulotte), un chêne isolé adulte (geai, chevêche) : tout ce qu'une grande ferme a déjà
vers l'an 10. Il n'en manque jamais rien « pour toujours » : la fiche dit quoi faire (« Il faut une mare : aménagez un
terrain en mare »).

### 17.5 Pêche au ruisseau et champignons du bois (les deux gestes du V3)

**Pêche au ruisseau** (Ru des Saules à l'étape 2) : un **ponton** au bord du ruisseau, dans la vue ; le toucher = une
pêche (une par jour, indépendante de la pêche de la mare du lot 2, qui ne change pas). Seul le joueur pêche. Tirage sur le
flux `valley3` (2 nombres : le poisson, la valeur). Fenêtre courte (≤ 40 % de l'écran) : le poisson, son nom, « + 14 ».

| Poisson | Pièces | Poids (étape 2) | Poids (étape 3 et plus) |
|---|---|---|---|
| Vairon (`minnow`) | 4 à 8 | 40 | 30 |
| Goujon (`gudgeon`, dessin du lot 2) | 5 à 10 | 35 | 25 |
| Chevesne (`chub`) | 10 à 18 | 25 | 20 |
| Truite fario (`browntrout`) | 20 à 32 | — | 15 |
| Écrevisse (`crayfish`) | 18 à 28 | — | 10 |

Facteurs : libellules × 1,25 et étang du moulin × 1,15 (comme pour la mare) ; l'année à thème « grenouilles » (canne de
Firmin, + 50 %) compte aussi. Valeur moyenne ≈ 9 (étape 2) puis ≈ 13 (étape 3).

**Champignons d'automne** (bois de la Combe à l'étape 2) : en automne, à chaque aube, **50 %** de chances qu'un champignon
pousse dans le bois (3 à la fois au plus ; 2 nombres `valley3` tirés à chaque aube d'automne dès l'étape 2, qu'il y ait de
la place ou non). Toucher = cueillir (seul le joueur). Ils restent jusqu'à la fin de l'automne (effacés au 1ᵉʳ jour
d'hiver, comme la cueillette des haies ; ils reviennent l'automne suivant).

| Champignon | Pièces (× f = 1 + 0,5 × (rang − 1), comme la cueillette des haies) | Poids |
|---|---|---|
| Cèpe (`cep`) | 6 | 1 |
| Girolle (`chanterelle`) | 4 | 1 |
| Pied-de-mouton (`hedgehogMushroom`) | 3 | 1 |

### 17.6 Les arbres du verger conservatoire

- **Reinette grise du Canada** (†) (`reinetteGrise`, culture `apple`, trait **Généreuse**, greffon) : une **variété
  ancienne** comme le Calville et l'Api étoilé (3 greffons, 1 greffon par panier cueilli à la main, sauvée après 7 paniers
  — 5 avec la Grainothèque niveau 3) ; étiquette « Du verger de la commune » ; anecdote « Rugueuse et grise comme une vieille
  pierre : sa chair acidulée fait les meilleures tartes. » Elle compte comme un signe de vie ; sur l'étagère de la
  Grainothèque, elle se range au bout de « Du pays » sous une petite étiquette « du verger de la commune » (aucune case
  ajoutée à une page d'album existante).
- **Cerisier Montmorency** (†) (`cherry`) et **Poirier Louise-Bonne** (†) (`pear`) : deux **arbres fruitiers nouveaux**
  (les dessins de la phase B, `tree.cherry.*` et `tree.pear.*`, enfin plantables), **hors de `CROPS`** (liste à part
  `VALLEY_TREES`, comme les graines rares : le marché, les trouvailles et l'« Herbier complet » ne changent pas). Jeune plant
  acheté dans la feuille d'une parcelle de verger vide (seulement après l'étape du verger qui le donne) ; mêmes règles que le
  pommier (pas d'arrosage, pas de gel, les abeilles comptent, l'équipe récolte après l'attente F1) ; **cours fixe** (comme
  les graines rares) ; jamais demandés par le tableau, la charrette, Joseph ni le comice ; aucune recette d'atelier au V3
  (confiture de cerises et jus de poire : idée gardée).

| Arbre | Jeune plant | Adulte en | Fruits | Saisons des fruits | Vente |
|---|---|---|---|---|---|
| Pommier (rappel) | 45 | 6 jours | 3 jours | été, automne | 26 |
| Cerisier Montmorency | 60 | 6 jours | 3 jours | **printemps**, été | 27 |
| Poirier Louise-Bonne | 60 | 7 jours | 4 jours | été, automne | 36 |

Le cerisier donne **au printemps** (le seul fruit de printemps) ; le poirier rapporte autant par jour que le pommier, en
plus beau. Anecdotes : « Ses cerises acides font les meilleures clafoutis : on les cueillait pour la fête du village. » ·
« Une poire fondante, née dans un jardin normand il y a deux siècles. »

### 17.7 Dix habitants de la vallée (page d'album nouvelle « Le carnet d'Hélène »)

Même automate qu'aux V1 et V2 (recette lisible, indice la veille, venue, **il faut les toucher**, pour toujours), mais
**dans la vue de la vallée** : la bête attend à son lieu avec un « ? » ; la ligne « À faire » et le prochain indice
disent « Un martin-pêcheur vous attend au ruisseau » (toucher → la vue s'ouvre et défile jusqu'à lui). Tirages sur le flux
**`valley3`** (10 nombres par aube, un par espèce, candidate ou non) ; venue réglée comme au V1 (20 % par aube que la bête
s'annonce, recette remplie et saison d'arrivée ; puis 50 % par aube qu'elle soit là, au plus tard la 3ᵉ aube) ; **une
seule venue annoncée par aube toutes espèces confondues** (si une espèce du V1 ou du V2 s'est annoncée ce matin, celles de
la vallée attendent : aucun tirage en moins ni en plus).

Leur rôle : **ce sont elles qui ouvrent les étapes suivantes** (§ 17.4) ; elles ne rapportent rien d'autre (leurs lieux
ont déjà leur avantage) — on les accueille pour elles-mêmes, et pour le carnet d'Hélène.

| id | Espèce (accord) | Recette | Arrive | Où on la voit | Indice (la veille) | Anecdote |
|---|---|---|---|---|---|---|
| `kingfisher` | Martin-pêcheur (m) | Ru des Saules à l'étape 2 | toute l'année | sur une branche au-dessus du ruisseau | « Un éclair bleu et un petit cri aigu, au ras de l'eau… » | Il plonge comme une flèche et ressort avec un poisson en travers du bec. |
| `crayfish` | Écrevisses à pattes blanches (f, pl.) | Ru des Saules à l'étape 3 | printemps → automne | sous les cailloux, près du pont | « De petites pinces sous les cailloux du ruisseau… » | Elles ne vivent que dans l'eau très pure : leur retour est une fête. |
| `otter` | Loutre (f) | Ru des Saules à l'étape 4 + étang du moulin à l'étape 2 | toute l'année | sur la berge, près du moulin | « Des traces palmées dans la vase, et une glissade sur la berge… » | Elle glisse sur les berges encore et encore, juste pour le plaisir. |
| `heron` | Héron cendré (m) | Étang du moulin à l'étape 1 | toute l'année | debout dans l'eau de l'étang | « Une grande silhouette grise, immobile au bord de l'eau… » | Il peut attendre une heure sur une patte avant de pêcher. |
| `blackWoodpecker` | Pic noir (m) | Bois de la Combe à l'étape 1 | toute l'année | sur un tronc du bois | « Un tambour sec, tout là-haut, dans le bois… » | Il tambourine jusqu'à vingt coups par seconde : c'est sa façon de chanter. |
| `roeDeer` | Chevreuil (m) | Bois de la Combe à l'étape 2 | toute l'année | à la lisière du bois | « Des traces fines, en cœur, dans la boue du sentier… » | Quand il a peur, il aboie : on dirait un petit chien dans le bois. |
| `salamander` | Salamandre tachetée (f) | Bois de la Combe à l'étape 3 | printemps, automne | sous les feuilles, au pied d'un vieil arbre | « Une tache jaune et noire sous les feuilles mouillées… » | Elle sort les soirs de pluie et peut vivre plus de vingt ans. |
| `skylark` | Alouette des champs (f) | Prairie des Coquelicots à l'étape 1 | printemps, été | au-dessus de la prairie | « Un chant qui monte, monte, tout là-haut dans le ciel… » | Elle chante en s'élevant, si haut qu'on ne la voit plus. |
| `hoopoe` | Huppe fasciée (f) | Prairie des Coquelicots à l'étape 2 + 2 tas de bois sur la ferme | été | sur un piquet de la prairie | « Un "oup-oup-oup" tout doux, du côté de la prairie… » | Elle dresse sa huppe en éventail quand on la surprend. |
| `littleOwl` | Chouette chevêche (f) | Bocage à l'étape 2 + un chêne isolé adulte sur la ferme | toute l'année | dans un vieux saule têtard | « Deux yeux jaunes dans un vieux saule, au crépuscule… » | Toute petite, elle hoche la tête quand elle vous regarde. |

Bienvenues : « Bienvenue, petit martin-pêcheur ! », « Bienvenue, petites écrevisses ! », « Bienvenue, petite loutre ! »,
« Bienvenue, beau héron ! », « Bienvenue, petit pic ! », « Bienvenue, petit chevreuil ! », « Bienvenue, petite
salamandre ! », « Bienvenue, petite alouette ! », « Bienvenue, belle huppe ! », « Bienvenue, petite chevêche ! ».

Fenêtre d'observation : celle du V1 (feuille basse, la bête recentrée au-dessus, dans la vue), avec la ligne « ✓ Le carnet
d'Hélène » et, à la place du service, ce que la bête ouvre : « Le ruisseau peut maintenant passer à "Les truites
reviennent". »

### 17.8 Les terres sauvages (sur la carte de la ferme, après le 16ᵉ terrain)

**Ce que c'est.** Quand la ferme possède ses **16 terrains** (le plus haut permis, rang 6) et que la vue de la vallée est
ouverte, chaque **case de forêt** qui reste dans la grille des terrains (colonnes −2 à 2, rangées 0 à 6 : 34 cases moins la
ferme… moins les 16 terrains = **18 cases**) peut être **confiée à la nature**, si elle **touche par un côté** un terrain,
la ferme de départ ou une terre déjà sauvage (la nature gagne de proche en proche, comme la ferme a grandi). Ce n'est **pas
une ferme de plus** : aucune parcelle, aucun bâtiment, aucune charge de saison, aucun employé, aucune production. On y
**accueille** la nature, et on la regarde revenir.

**Trois sortes** (au choix du joueur, une fois pour toutes) :

| Sorte | id | Ce qu'on voit en reprenant (3 états) | Visiteurs, une fois reprise (décor, hachage du jour) | Petit texte |
|---|---|---|---|---|
| **Le bois** | `wood` | terre retournée et pousses → noisetiers et bouleaux → un bois clair, de grands chênes | chevreuil (s'il est installé dans la vallée), geai, écureuil | « Laissez faire : en dix ans, un bois se plante tout seul. » |
| **Le marais** | `marsh` | flaques et joncs → mares, iris jaunes → roselière, eau qui dort | héron (s'il est installé), grenouilles, libellules | « De l'eau qui dort, des joncs : la maison des grenouilles. » |
| **La prairie sauvage** | `grassland` | herbe rase → herbe haute et marguerites → prairie fleurie, buissons | lièvre, alouette (si installée), papillons | « De l'herbe haute qu'on ne fauche plus : les papillons s'y perdent. » |

| Règle | Valeur |
|---|---|
| Prix | **2 500 + 300 × n** (n = terres déjà confiées) : 2 500 → 7 600 ; les 18 : **90 900** ; 100 % au patrimoine (poste « La Vallée ») |
| Reprise | **jeune** après 1 saison, **reprise** après 3 saisons (dessins de l'état 0 à 2) |
| Signe de vie | chaque terre **reprise** (état 2) compte pour un signe de vie |
| Réversible ? | **non** (comme un aménagement) : la petite feuille de confirmation le dit doucement (« Le Bois Joli deviendra un bois, pour toujours. ») |
| Recettes | **aucune** recette ne dépend des terres sauvages (beaucoup de fermes n'auront jamais 16 terrains) |
| Nom | la case garde son nom de la carte (« Le Bois Joli », « Les Saules », « Le Chemin Creux »…) |

**Sur la carte de la ferme (scène).** Une fois les terres sauvages ouvertes, les cases de forêt **qui peuvent être
confiées** entrent dans le monde comme le faisaient les terrains à vendre (la carte s'étend jusqu'à elles) : forêt un peu
plus claire, et au bas de la case un **petit poteau à feuille** (« Terre sauvage ? ») au lieu du panneau « À vendre ».
Toucher le poteau (ou « Confier une forêt » dans la fiche « La Vallée › Lieux ») passe la scène en **mode terres
sauvages** (comme le mode aménagement : barre `#vl-wildbar` « 🌿 Terre sauvage · 3 400 · Touchez une forêt · Terminer » à la
place des onglets ; seules les cases possibles pulsent, en pointillé épais avec une pousse dans un cercle, lisible sans la
couleur ; défilement, pincement et + / − actifs ; zoom tactile, § 17.11). Toucher une case → feuille basse : trois grandes
cartes (≥ 72 px : dessin de la sorte reprise, nom, petit texte) → « Confier à la nature · 3 400 ». La terre sauvage se
dessine ensuite comme un **bloc de 14 × 11 tuiles sans clôture ni allée** (fond et objets de sa sorte, selon son état),
avec son petit poteau en bas à gauche ; toucher le bloc → sa fiche (nom, sorte, état, « encore 2 saisons avant le bois »,
visiteurs déjà vus). Aucun employé n'y va ; les allées de la ferme ne la traversent pas.

**Sur la mini-carte.** Une terre sauvage est une case de sa couleur (bois `#2e5a2a`, marais `#3f6f6a`, prairie sauvage
`#a3b64f`) avec son pictogramme (`icon.wildland.<sorte>`, et un petit trait plus clair tant qu'elle n'a pas repris) ; une
case qu'on peut confier : la forêt avec un contour pointillé vert clair et une petite pousse (comme « À vendre », mais
vert). En mode terres sauvages, un point clair sur chaque case possible. La grande carte des terrains montre la même chose,
avec le nom de chaque case.

**Une fois les 18 confiées** : plus aucune forêt de la grille ne reste « à confier » ; la lisière dense au-delà de la
grille ne change pas (le V4 dessinera la forêt de la carte en quatre états).

### 17.9 Signes de vie, étapes 6 et 7

- **Signes de vie avec le V3** : espèces installées (16 + **10**) + variétés sauvées (35 + **1**, la Reinette grise) +
  **étapes de lieux atteintes** (19) + **terres sauvages reprises** (18) = **99** (au lieu de 51).
- **Paliers** (partie `places` ouverte) : étapes 1 à 5 **inchangées** (2 / 6 / 11 / 22 / 38, ceux du V2) ; **étape 6 à 56
  signes ET le Ru des Saules à l'étape 2** ; **étape 7 à 76 signes ET les six lieux à l'étape 2 au moins** (au-dessus du
  palier 38 de l'étape 5, comme demandé au § 16.7). Sans le V3 : les paliers du V2, étape 5 au plus. Jamais de recul.
- La rangée de silhouettes de la fiche « La Vallée » : « 62 signes de vie · prochaine étape à 76 » ; à l'étape 7 : « 87
  signes de vie sur 99 ».

| Étape | Nom | Condition | Ce qui change (ferme et vue) | Ce que la vallée vous rend | Chapitre de Joseph |
|---|---|---|---|---|---|
| 6 | L'eau revient | 56 signes + Ru des Saules à l'étape 2 | brume du matin sur la vue et sur la ferme au printemps ; le ruisseau s'entend (ambiance) | **l'eau revient** : un jour sans arrosage, les cultures poussent **+ 0,1 jour** (Détente 0,85 au lieu de 0,75 ; Classique 0,6 au lieu de 0,5) ; **60 écus** | « Tu l'entends ? Le ruisseau. » · « Soixante ans que le Ru des Saules était à sec. » · « Ma mère disait : quand l'eau revient, tout revient. » |
| 7 | La vallée vivante | 76 signes + les six lieux à l'étape 2 | la forêt autour de la ferme s'éclaircit (clairières fleuries), vols d'oiseaux dans la vue, les bêtes de la vallée passent parfois sur la ferme (décor) | décor « **Le banc du belvédère** » ; **80 écus** | « Monte avec moi sur la colline, une dernière fois. » · « Le bois, la prairie, l'étang, les haies… tout respire. » · « Tu as rendu sa vallée à ma mère, petit. Merci. » |

Vignettes `valley.stage.6` et `valley.stage.7` (96 × 48, la même vallée que les étapes 0 à 5, avec l'eau puis les bois).
L'étape 8 (« Les cigognes ») reste au V4.

### 17.10 Récits, album, succès

**Récits de Joseph** (fenêtre des chapitres, ne se ferme pas d'un toucher dehors, attendent d'être lus, ligne « À
faire » `vl-story`, relisibles dans « Les récits de Joseph ») :

| id | Titre | Quand | Vignette | Trois lignes |
|---|---|---|---|---|
| `hill` | Sur la colline | étape 5 atteinte, V3 ouvert | `story.hill` | § 17.2 |
| `helene` | Hélène, la naturaliste | premier habitant de la vallée installé | `story.helene` | § 17.2 |
| `brook3` | Le moulin de mon père | Ru des Saules à l'étape 4 | `story.brook` | « La roue tourne, l'eau chante, la farine vole. » · « Mon père m'asseyait sur le sac de blé pour la pesée. » · « Je n'aurais jamais cru entendre ce bruit-là une seconde fois. » |
| `combe3` | La vieille futaie | bois de la Combe à l'étape 3 | `story.combe` | « Ce matin, un chevreuil m'a regardé passer, sans bouger. » · « Ma mère venait ici cueillir les champignons, à l'automne. » · « Je crois qu'elle en aurait pleuré, tu sais. » |
| `poppies3` | Les orchidées | prairie à l'étape 3 | `story.poppies` | « Hélène a compté onze sortes d'orchidées dans la prairie. » · « Onze ! Il n'y en avait plus une seule. » · « Laisse-la tranquille, cette prairie. Elle sait ce qu'elle fait. » |
| `millpond3` | Le dimanche à l'étang | étang à l'étape 3 | `story.millpond` | « Tout le village vient se promener autour de l'étang, le dimanche. » · « Les enfants comptent les grenouilles, les vieux comptent les nénuphars. » · « Moi, je compte les hirondelles. Il y en a de plus en plus. » |
| `bocage3` | Le chemin creux | bocage à l'étape 3 | `story.bocage` | « J'ai pris le chemin creux pour venir, ce matin. » · « Des haies de chaque côté, et une chevêche qui m'a fait la révérence. » · « Le chemin de mon enfance, petit. Tu me l'as rendu. » |
| `oldOrchard3` | Le conservatoire | verger à l'étape 3 | `story.oldOrchard` | « Chaque arbre a son étiquette, maintenant : Calville, Api, Reinette… » · « L'école vient y faire la leçon de choses. » · « Une graine qu'on donne vit. Un arbre qu'on greffe aussi. » |

Les chapitres 6 et 7 (étapes) sont ceux du § 17.9 (même fenêtre, vignette de l'étape).

**Album** (deux pages **nouvelles**, mode « carrière », aucune case ajoutée à une page existante ; « L'album complet » reste
les 11 pages du lot 4) :

| Page | Cases | Condition | Récompense |
|---|---|---|---|
| `valleyWild` « Le carnet d'Hélène » | 10 | habitant de la vallée installé | 30 écus + décor « La girouette au héron » (`heron.vane`, petit) |
| `places` « Les lieux de la vallée » | 6 | lieu à sa dernière étape | 40 écus + décor « La roue du moulin » (`mill.wheel`, grand) |

**Succès** (catégorie « Carrière », écus seulement ; rangés sous « La Vallée » dans la grange) :

| id | Nom | Condition | Écus |
|---|---|---|---|
| `firstWorks` | Le premier chantier | lancer un premier chantier | 10 |
| `waterBack` | L'eau revient | atteindre l'étape 6 | 30 |
| `livingValley` | La vallée vivante | atteindre l'étape 7 | 40 |
| `sixPlaces` | La vallée restaurée | les six lieux à leur dernière étape | 40 |
| `helenesBook` | Le carnet d'Hélène | installer les 10 habitants de la vallée | 30 |
| `firstWild` | Une terre rendue | confier une première terre à la nature | 10 |
| `forestBack` | La forêt revient | confier les 18 terres sauvages | 40 |
| `riverAngler` | Pêcheur du ruisseau | 20 pêches au ruisseau | 10 |

Total : 210 écus (+ 140 écus d'étapes et de pages).

### 17.11 Écrans du téléphone (portrait, 412 × 915 et 360 × 740)

Cibles ≥ 48 px, textes ≥ 14 px (12 px pour les mentions), pictogramme **et** mot partout, pause pendant la lecture et dans
la vue, mouvements réduits partout, lecteurs d'écran (« étape 2 sur 4 », « en reprise, encore 3 jours », « installé »).

#### 17.11.1 La fiche d'un lieu (feuille basse, ≤ 70 % de l'écran, la vue visible au-dessus)

```
┌──────────────────────────────────────┐
│ [vignette du lieu × 2]  Le Ru des Saules │  16 px
│                     Étape 2 sur 4      │
│                     ●●○○ Le ruisseau chante │
│ ┌ En reprise ──────────────────────┐ │  (pendant une reprise)
│ │ Les truites reviennent           │ │
│ │ ▓▓▓▓▓▓░░░░  encore 4 jours       │ │  barre lue « 60 % »
│ └──────────────────────────────────┘ │
│ ─ ou ─                                │
│ Prochaine étape : Les truites reviennent │
│  ✓ Le bois de la Combe à l'étape 1    │  lignes cochées 14 px
│  ✗ Le martin-pêcheur installé  [Voir] │  « Voir » → la bête si elle attend
│  Reprise : 2 saisons                  │
│ [  Lancer le chantier · 13 000  ]     │  ≥ 56 px ; grisé + raison lue sinon
│ Ce que le ruisseau vous rend :        │
│  ✓ Canicule : ½ jour sans arrosage    │
│  ✓ Pêche au ruisseau, une fois par jour │
│  ○ Truites et écrevisses (étape 3)    │
│ Habitants : [martin ✓] [écrevisses ?] [loutre ?] │  silhouettes 48 px + nom
│ « Écoute-le courir sur les cailloux. » │  Joseph, 14 px italique
└──────────────────────────────────────┘
```

- « Lancer le chantier » ouvre une petite confirmation (« Le chantier des truites · 13 000 · reprise 2 saisons ·
  [Lancer] ») ; puis le panneau de chantier se plante sur le lieu sous les yeux, son `reveal`, message info « Chantier lancé :
  Les truites reviennent (2 saisons) ».
- Lieu restauré (dernière étape) : bandeau « Restauré ✓ », la liste de ce qu'il rend, le récit relisible.

#### 17.11.2 La fiche « La Vallée » : segment **Lieux** (4ᵉ segment)

- En tête, la carte **« Voir la vallée »** (vignette de l'étape × 3, « 7 étapes sur 19 », bouton ≥ 48 px).
- Puis **6 lignes** (≥ 72 px) : icône du lieu, nom, « Étape 2 / 4 », état (« en reprise · encore 3 jours » · « prêt ·
  7 000 » · « attend : le martin-pêcheur » · « Restauré ✓ ») → la fiche du lieu (dans la vue).
- Puis la carte **« Terres sauvages »** : avant le 16ᵉ terrain, « Après le 16ᵉ terrain, les forêts autour de la ferme
  pourront revenir à la nature » ; ensuite « 3 / 18 · [Confier une forêt · 3 400] » (mode terres sauvages).
- Les **quatre segments** (Graines · Habitants · Aménager · Lieux) tiennent sur une ligne à 100 % ; sous 380 px de large
  avec un texte ≥ 130 %, ils passent en **grille 2 × 2** (chaque segment ≥ 48 px).
- Segment **Habitants** : les 10 habitants de la vallée dans un groupe replié « De la vallée » (même ligne que le V1 ;
  recette = lieu et étape, « Il vous attend au ruisseau [Aller voir] »).

#### 17.11.3 Fiches et lignes existantes enrichies

- **Le prochain indice** (toujours un seul), ordre : bête à voir (ferme **ou vallée**) ; chapitre ou récit ; troc ;
  bocal ; planche mûre ; paire ; graines à semer ; **un lieu prêt** (condition remplie, payable en gardant 2 saisons de
  charges : « Le Ru des Saules peut passer à "Le ruisseau chante" ») ; recette la plus proche ; Grainothèque ; **ce qui
  manque au lieu le plus proche** (« Le ruisseau attend 2 haies de plus ») ; **une terre sauvage** (payable avec la même
  réserve) ; étape suivante.
- **Ligne « À faire »** : `vl-view-animal` « Un martin-pêcheur vous attend au ruisseau », `vl-mushrooms` « Des
  champignons dans le bois de la Combe », `vl-story` (récits du V3). Jamais de ligne pour un chantier à payer.
- **Résumé du matin** : « Au ruisseau, l'eau a repris : le ruisseau chante », « Des traces palmées près du moulin… »
  (indice), « 2 champignons dans le bois ».
- **Messages** : importants — un lieu atteint une étape (« Le Ru des Saules : le ruisseau chante ! » · « Voir »), bête de la
  vallée venue (« Voir »), étape de la vallée ; infos — chantier lancé, pêche, champignon cueilli, terre qui reprend.
- **Bilan de l'année**, bloc « La vallée cette année » : + chantiers, étapes de lieux atteintes, habitants de la vallée,
  terres sauvages, pêches au ruisseau.
- **Feuille d'une parcelle de verger vide** : « Cerisier Montmorency · 60 » et « Poirier Louise-Bonne · 60 » (avec un sceau
  « du verger conservatoire ») une fois débloqués ; greffon de Reinette dans « Graines anciennes ».
- **Carnet › Bilan** : dépenses de la Vallée au patrimoine (V3 compris). **Grange › Succès** : « La Vallée · n / 21 ».
- **Conseils « première fois »** : `valley.view` (première vue : « Touchez un lieu pour voir ce qui lui manque. »),
  `valley.works` (premier chantier : « Le lieu reprend tout seul, saison après saison : revenez le voir. »),
  `valley.valleyAnimal` (première bête de la vallée), `valley.river` (première pêche au ruisseau), `valley.wild` (premières
  terres sauvages : « Une forêt rendue à la nature ne produit rien : elle accueille. »).

#### 17.11.4 Les trois petits restes du V2 (intégrés au contrat UI du V3)

1. **Cibles ≥ 48 px même au zoom minimal.** Toute cible **isolée** de la scène (bête, trouvaille, boîte en fer, Grainothèque
   et son panneau, sachet du tableau, emplacements du mode aménagement, poteau « Vers la vallée », poteau d'une terre
   sauvage, case du mode terres sauvages) a une **zone de toucher d'au moins 48 × 48 px CSS calculée en coordonnées
   écran** (agrandie autour de son centre, quel que soit le zoom ; deux zones qui se chevauchent : la plus proche du doigt
   gagne, puis l'ordre de priorité existant). Les cibles **en grille** (parcelles, mode paire) prennent toute leur case
   (clôture et allée comprises jusqu'à mi-chemin de la voisine) ; et les modes qui demandent de viser (aménagement, paire,
   terres sauvages) **posent d'eux-mêmes le « zoom tactile »** (le plus petit zoom entier où une parcelle fait ≥ 48 px : × 4
   sur le Pixel 7) s'il est plus petit, et rendent le zoom du joueur en sortant. Test mesuré au zoom minimal.
2. **Lignes « À faire » limitées.** La liste interne est **regroupée** avant affichage : les choses urgentes (corbeaux,
   charges qui manquent : priorité ≤ 25) restent seules ; deux lignes ou plus d'une même **famille** (le village : tableau,
   troc, charrette, colporteur, cadeau, défis, commandes ; la vallée : bêtes, bocaux, récits, planches, champignons ; les
   fêtes ; Joseph) deviennent **une seule ligne** (« Le village : 4 choses », priorité de la plus pressante) qui ouvre une
   petite feuille de 4 lignes au plus (≥ 56 px). **Cinq entrées au plus** ; la ligne montre la première ; « Où en
   étais-je ? » en montre trois. Jamais 11.
3. **Le conseil du tableau ne couvre plus le troc.** Une seule bulle par ouverture de feuille : quand la carte « Troc » est
   en tête du tableau, le conseil `valley.troc` passe d'abord (cible « Choisir une graine ») et le conseil du lot 3 (« Le
   tableau du village… ») attend la prochaine ouverture du tableau ; une bulle évite aussi toute zone qu'on lui désigne
   (`avoid`) — jamais par-dessus « Choisir une graine ».

### 17.12 Équilibrage

#### 17.12.1 Repères (V1 + V2, § 16.12.7 et trace `--trace --seed 3 --strategy casual --years 18`)

Joueur tranquille : Domaine à l'an 7 ou 8 ; 16ᵉ terrain à l'an 11 (graine 3) ; étape 5 à l'an 9 (médiane) ; Grainothèque
complète à l'an 12 ; revenu ≈ 50 000 à 62 000 par an après l'an 10 ; bénéfice + 41 000 à + 52 000 par an des ans 13 à 18 ;
**argent en caisse** (graine 3) 32 000 (an 10) · 13 500 (an 11) · 20 600 (an 12) · 61 500 (an 13) · **106 000 (an 14)** ·
154 000 (an 15) · 199 000 (an 16) · 250 000 (an 17) · **292 000 (an 18)** ; médiane (60 carrières) à l'an 14 : **128 285**
(70 % de sans la Vallée, 183 344) ; à l'an 18 : 88 % de sans la Vallée. Signes de vie : 38 à l'an 9, 51 à l'an 13.

**Ce que ça veut dire** : des ans 9 à 18, le joueur tranquille dispose d'environ **290 000** pièces (argent de l'an 12 +
bénéfices des ans 13 à 18), dont il doit garder ≈ 4 saisons de charges. Les 369 000 de l'aperçu ne peuvent pas être finis
vers l'an 18 (ils le seraient vers l'an 20 ou 21) ; **≈ 251 000** le sont, avec ≈ 45 000 en caisse à la fin.

#### 17.12.2 Le puits du V3

| Poste | Aperçu (§ 11.3) | V3 | Détail |
|---|---|---|---|
| Chantiers des 6 lieux | ≈ 175 000 | **160 000** | Ru 45 500 · Bois 21 500 · Prairie 17 000 · Étang 34 500 · Bocage 19 000 · Verger 22 500 |
| Terres sauvages | 4 000 + 800 × n (≈ 194 000) | **2 500 + 300 × n = 90 900** | 18 cases |
| Arbres du verger (jeunes plants) | — | ≈ 300 à 700 | cerisiers et poiriers plantés |
| **Total** | ≈ 369 000 | **≈ 251 000** | 100 % au patrimoine |

#### 17.12.3 Calendrier visé du joueur tranquille (médiane)

| An | Ce qui arrive (V3) | Dépenses du V3 (cumul) | Nouveautés |
|---|---|---|---|
| 9 | étape 5 → « Sur la colline », poteau, vue ; prairie 1 | 2 000 | 2 saisons |
| 10 | bocage 1, Ru 1, bois 1 ; alouette, pic noir | 11 000 | 4 saisons |
| 11 | (16ᵉ terrain, Grainothèque N4) verger 1, Ru 2 ; pêche au ruisseau ; martin-pêcheur ; « Hélène » | 21 000 | 4 saisons |
| 12 | (Grainothèque N5) étang 1, prairie 2 ; héron, huppe ; Reinette grise | 31 500 | 4 saisons |
| 13 | bocage 2, bois 2, verger 2 ; **étape 6** ; chevreuil, chevêche ; champignons ; cerisiers | 50 000 | 4 saisons |
| 14 | Ru 3, étang 2 ; écrevisses | **74 000** | 4 saisons |
| 15 | prairie 3, bocage 3, bois 3 ; 3 terres sauvages ; salamandre | 115 400 | 4 saisons |
| 16 | verger 3, Ru 4 ; 4 terres ; **étape 7** ; loutre ; poiriers | 165 800 | 4 saisons |
| 17 | étang 3 ; 5 terres | 209 800 | 3 à 4 saisons |
| 18 | les 6 dernières terres : **vallée complète** | **250 900** | 3 saisons |

Argent en caisse visé : **≈ 55 000 à l'an 14** (≈ 30 % de sans la Vallée ; V2 : 128 000) et **≈ 45 000 à l'an 18**.

#### 17.12.4 D'où viendrait le revenu en plus (estimation, à mesurer)

| Source | Estimation (tranquille, ans 10 à 18, par rapport au V1 + V2) |
|---|---|
| Étape 6 « l'eau revient » (+ 0,1 jour sans arrosage) ; canicule du Ru 1 | + 0,3 à + 0,6 % |
| Pêche au ruisseau (≈ 50 % des jours joués × 28 jours × 9 à 13) | + 0,3 % |
| Moulin à eau (+ 1 place au moulin, si moulin) | + 0,2 à + 0,4 % |
| Corbeaux plus rares puis absents (bocage 2 et 3) | + 0,2 % |
| Cueillette des haies × 1,5 puis × 2 ; champignons | + 0,3 % |
| Ruches de la prairie, touristes + 10 %, abris + 5 %, poissons + 15 % | + 0,2 % |
| Cerisiers et poiriers (2 à 6 arbres) | + 0,1 à + 0,3 % |
| Chauffage − 50 %, entretien − 10 % (charges) | ≈ 0 sur le revenu (+ 0,2 % de bénéfice) |
| **Total** | **≈ + 1,5 à + 2,5 %** sur les ans 10 à 18 ; **≈ + 1 %** sur 18 ans (cible + 0 à + 4 %) |

#### 17.12.5 Cibles du V3 (`--compare-valley3` : V1 + V2 → V1 + V2 + V3, même graine ; 60 carrières × 18 ans, Détente, saisons de 7 jours ; `--years 14` pour l'argent de l'an 14)

| Mesure | Cible |
|---|---|
| Tranquille : revenu (18 ans, et ans 10 à 18) | **+ 0 à + 4 %** par rapport au V1 + V2 ; toute la Vallée ≤ + 8 % par rapport à sans |
| Tranquille : argent en caisse à l'an 14 | **plus bas qu'avec le V2 seul** (128 285) et **≤ 50 %** de sans la Vallée (≤ ≈ 92 000) ; visé ≈ 55 000 |
| Tranquille : argent en caisse à l'an 18 | ≤ 25 % de sans la Vallée ; jamais sous 2 saisons de charges à cause du V3 |
| Tranquille : vallée complète | 19 étapes, 10 habitants de la vallée et (16 terrains) 18 terres **vers l'an 18** (an 17 à 19) ; étape 6 an 12 à 14 ; étape 7 an 15 à 17 (visée an 16) |
| Tranquille : dépenses du V3 | an 14 : 50 000 à 90 000 ; an 18 : ≈ 251 000 |
| Tranquille : rangs, Domaine | identiques **à un an près** (dépenses à 100 % au patrimoine) |
| Tranquille : nouveautés | **≥ 80 %** des saisons avec au moins une nouveauté de la Vallée, ans 10 à 18 (médiane) |
| Tranquille : gestes par jour (ans 10 à 18) | + 0,2 à + 0,8 (vue, pêche, champignons, observation) ; part des récoltes à la main ≥ 50 % |
| Faillites | **aucune** en Détente ; Carrière Classique, tranquille : faillites ≤ 20 % (inchangé ; 0 visé) |
| Ferme laissée seule (`handsOff`, ans 4 à 7) | bénéfice **≤ + 3 %** (le V3 n'est jamais ouvert : ≈ 0) |
| Ferme laissée seule tard (`handsOffLate`, nouveau : tranquille les ans 1 à 12, puis rien les ans 13 à 16) | bénéfice des ans 13 à 16 **≤ + 3 %** par rapport au V1 + V2 (les services passifs du V3 restent petits) |
| `automator` | **aucune étape** qui demande un habitant de la vallée ; aucun habitant de la vallée ; patrimoine ≤ + 3 % |
| Appliqué | tout restauré **an 12 à 14** ; revenu ≤ + 6 % par rapport à sans la Vallée |
| Débutant | rang 3 à l'an 5 dans ≥ 70 % (inchangé) ; le V3 s'ouvre quand il atteint l'étape 5 (souvent après l'an 14 : rien n'est perdu) |
| Niveaux | **identiques** : `node tools/simulate.js` octet pour octet, parité 400 / 400 ; Classique des niveaux strictement inchangé |
| `{ places: false }` | exactement le V1 + V2 (empreinte d'une carrière de 18 ans) |

#### 17.12.6 Robots (par l'API publique et un tirage propre `me.placesRnd`, comme aux V1 et V2)

- **Tranquille** : ouvre la vue **un jour joué sur trois** (1 geste) ; y observe une bête de la vallée qui attend (70 %),
  pêche au ruisseau (50 % des jours joués, 1 geste), cueille les champignons (50 %, 1 geste chacun) ; **un regard par
  saison** sur les lieux : lance le chantier **le moins cher dont la condition est remplie** si l'argent − prix > 4 saisons de
  charges **et** si le prochain achat de sa liste d'envies reste payable (« la ferme d'abord ») ; deux chantiers par saison
  au plus ; **terres sauvages** (16 terrains) : une par saison si l'argent − prix > 6 saisons de charges (deux par saison
  après l'an 15), sortes en tour (bois, prairie, marais) ; plante 2 cerisiers et 2 poiriers quand une parcelle de verger se
  libère (n'arrache rien) ; pose les haies, bandes et tas qui manquent à une condition (dans sa liste d'aménagements).
- **Débutant** : 30 % de tout cela ; un chantier seulement si l'argent couvre trois fois son prix.
- **Appliqué** : tout, dès que possible (réserve de 4 saisons de charges) ; ouvre la vue chaque jour où quelque chose
  l'attend.
- **`automator`** : lance les chantiers et confie les terres (décisions), **aucun geste** (ni vue, ni pêche, ni
  observation) : bloqué aux étapes qui demandent un habitant de la vallée.
- **`handsOff`, `handsOffLate`, `idle`** : rien après leur dernière année jouée.
- Gestes : ouvrir la vue 1, observer 1, pêcher 1, cueillir 1 ; chantier, terre, plant : 0 (décisions de boutique).

#### 17.12.7 Leviers si une cible n'est pas tenue (dans cet ordre)

Prix des chantiers (× 0,8 à × 1,2, total entre 130 000 et 190 000) ; prix des terres (base 2 000 à 3 000, pas de 200 à
400) ; reprises (1 / 2 / 4 saisons → 1 / 1 / 2 ou 2 / 3 / 4) ; chance de venue des habitants de la vallée ; paliers des
étapes 6 et 7 (50 à 60, 70 à 80) ; force des avantages (pousse sans arrosage + 0,1 → + 0,05 ; places du moulin ; touristes).
**Jamais** les chiffres des niveaux, le rythme des rangs ni les tirages d'un flux existant.

#### 17.12.8 Résultats et réglages (livraison CORE V3, 2026-10-03)

Mesure : `node tools/simulate-career.js --compare-valley3 --runs 60 --jobs 4` (Détente, saisons de 7 jours, 60 carrières ×
18 ans, même graine : sans la Vallée → V1 + V2 → V1 + V2 + V3 ; aide d'équipe `sim-career-staff.js` active). Classique :
`--difficulty classique --strategy casual --runs 30`.

**Réglages retenus** (leviers du § 17.12.7, dans l'ordre) : prix des chantiers (**160 000**), prix des terres
(**2 500 + 300 × n = 90 900**), paliers des étapes 6 et 7 (**56 / 76**), chance de venue et avantages : **inchangés** ;
**reprises 1 / 2 / 4 → 2 / 3 / 4 saisons** (étapes 1, 2, 3 ; Ru des Saules 2 / 2 / 3 / 3) — avec 1 / 2 / 4, l'étape 7
venait vers l'an 15 et la vallée complète vers l'an 17. Robots précisés (§ 17.12.6, détails dans `docs/ARCHITECTURE.md`,
« Écarts et précisions (livraison CORE V3) ») : le tranquille garde « l'argent qui dort » (un chantier ou une terre
seulement si l'argent couvre trois fois le prix, comme la Grainothèque du V2), finit les chantiers prêts avant de confier
une forêt, sème les jachères qu'un lieu demande.

| Mesure (tranquille, médiane sauf mention) | Cible | Mesuré |
|---|---|---|
| Revenu 18 ans / ans 10-18 (V1 + V2 → V3) | + 0 à + 4 % | **+ 0,6 %** / **+ 0,9 %** |
| Toute la Vallée par rapport à sans | ≤ + 8 % | **+ 7,3 %** |
| Argent en caisse an 14 (moyenne) | < 128 285 et ≤ 50 % de sans ; visé ≈ 55 000 | **33 358** (18 % de sans ; V2 seul : 128 285) |
| Argent en caisse an 18 (moyenne) | ≤ 25 % de sans | **55 640** (16 % de sans) |
| Dépenses du V3 an 14 / an 18 | 50 000 à 90 000 / ≈ 251 000 | **96 500** / **250 900** |
| Étape 6 / étape 7 | an 12 à 14 / an 15 à 17 (visée 16) | **an 13** (100 %) / **an 16** (97 %) |
| 19 étapes / 10 habitants de la vallée / 18 terres | vers l'an 18 | **an 17 / an 18 / an 18** ; vallée complète **an 18** (93 %) |
| Étapes des lieux (an) | — | Ru 11 / 13 / 16 / 17 · bois 11 / 13 / 15 · prairie 11 / 12,5 / 14,5 · étang 14 / 15 / 17 · bocage 11 / 12 / 15 · verger 11 / 13 / 16 |
| Nouveautés (saisons avec au moins une, ans 10-18) | ≥ 80 % | **94 %** (V1 + V2 : 36 %) ; 98 % des carrières ≥ 80 % |
| Gestes par jour (ans 10-18) | + 0,2 à + 0,8 ; à la main ≥ 50 % | **+ 0,84** ; à la main **86 %** |
| Rangs, Domaine | à un an près | **identiques** chaque année ; Domaine an 7 → an 7 |
| Faillites | aucune (Détente) ; Classique ≤ 20 % | **0 %** ; Classique **0 %** (revenu + 0,2 %) |
| `handsOff` (ans 4 à 7) | ≤ + 3 % | **+ 0,0 %** (la vue ne s'ouvre jamais) |
| `handsOffLate` (ans 13 à 16) | ≤ + 3 % | **− 2,9 %** (les avantages passifs restent petits) |
| `automator` | aucun habitant de la vallée ; patrimoine ≤ + 3 % | **0** ; **+ 0,0 %** (n'atteint pas l'étape 5) |
| Appliqué | tout restauré an 12 à 14 ; revenu ≤ + 6 % / sans | **an 13** (100 %) ; **+ 0,6 %** par rapport à sans (+ 1,1 % / V1 + V2) |
| Débutant | rang 3 à l'an 5 ≥ 70 % ; V3 quand il chante | **98 %** ; n'atteint pas l'étape 5 en 18 ans (rien n'est perdu) |
| Niveaux, `{ places: false }` | identiques | `node tools/simulate.js` identique octet pour octet ; parité 400 / 400 ; empreinte d'une carrière de 18 ans identique |

**Écarts restants et lecture.** L'argent en caisse à l'an 14 (≈ 33 000) reste sous le « visé » 55 000 : le calendrier du
§ 17.12.3 supposait les terres sauvages vers l'an 15, mais le 16ᵉ terrain arrive vers l'an 10-11 et le tranquille confie
une forêt chaque saison où aucun chantier prêt n'attend ; la cible dure (« plus bas qu'avec le V2 seul et ≤ 50 % de sans »)
est tenue largement. Les dépenses de l'an 14 (96 500) dépassent un peu la fourchette pour la même raison, et les gestes
(+ 0,84) un peu le plafond (la pêche du ruisseau, un jour joué sur deux).
*(Lecture corrigée à l'intégration, ci-dessous : ce ne sont pas les terres sauvages, mais les chantiers.)*

**Intégration et vérification (QA du V3, 2026-10-03).**

*Simulation relancée* (`node tools/simulate-career.js --compare-valley3 --runs 60 --jobs 4`, après les corrections de
l'intégration, qui ne touchent que l'interface et un texte) : chiffres **identiques** au tableau ci-dessus (revenu + 0,6 % /
+ 0,9 % ; argent an 14 : 33 358 ; an 18 : 55 640 ; étape 6 an 13, étape 7 an 16 ; vallée complète an 18, 93 % ; aucune
faillite ; `handsOff` + 0,0 %, `handsOffLate` − 2,9 %). `node tools/capture-parity.js --check` : 400 / 400 ;
`node tools/simulate.js` identique octet pour octet.

*Faut-il faire attendre les terres sauvages ?* **Non** (évalué, mesuré). La trace du tranquille (médiane, 60 carrières)
montre **1 terre à l'an 11, 2 aux ans 12 à 14**, 3 à l'an 15, 5 à l'an 16, puis 15 et 18 : les terres achetées avant l'an
14 ne pèsent que **≈ 5 300 pièces** sur les 96 500 dépensées (le robot finit d'abord les chantiers prêts). L'écart à
l'an 14 vient des **chantiers** (12 étapes de lieux à l'an 14, ≈ 91 000, contre ≈ 74 000 au calendrier du § 17.12.3).
Essai mesuré (`--strategy casual --runs 60`) avec les terres réservées à l'étape 6 « L'eau revient » :

| Tranquille (médiane sauf mention) | Sans attente (retenu) | Terres après l'étape 6 (essai) |
|---|---|---|
| Argent en caisse an 14 (moyenne / médiane) | 33 358 / 31 261 | 34 313 / 32 233 (+ 1 000) |
| Argent en caisse an 18 (moyenne) | 55 640 | 55 385 |
| Revenu 18 ans / ans 10-18 | + 0,6 % / + 0,9 % | + 0,5 % / + 0,7 % |
| Terres confiées (an 11 → 18) | 1 · 2 · 2 · 2 · 3 · 5 · 15 · 18 | 0 · 0 · 0 · 0 · 0 · 4 · 16 · 18 |
| Vallée complète | an 18 (93 %) | an 18 (95 %) |

L'attente ne rapproche pas l'an 14 des 55 000 visés (+ 1 000 seulement) et elle **entasse** les 18 terres sur les deux
dernières années (la carte ne changerait plus du tout des ans 11 à 15) : on garde la règle du § 17.8 (après le 16ᵉ
terrain, rien d'autre). Si l'argent dormant de l'an 14 doit monter vers 55 000, le levier est celui des **chantiers**
(§ 17.12.7 : prix × 1,1 à 1,2 sur les étapes 2 et 3, ou un chantier par saison au plus pour le tranquille) — à trancher
par l'utilisateur ; la cible dure (« plus bas qu'avec le V2 seul et ≤ 50 % de sans ») reste tenue.

*Vérifié au doigt* (Playwright, Chromium, Pixel 7 et 360 × 740, toucher seulement, `?debug=1&nosw`) : vraie carrière du V2
(fabriquée avec le code du commit `c958599` : étape 5, 16 terrains, 35 variétés) reprise sans rien perdre ; à la première
aube, vue ouverte, récit « Sur la colline » (message « Écouter »), puis la vue s'ouvre d'elle-même ; poteau « Vers la
vallée » touché dans la scène ; défilement au doigt (élan) ; cinq lieux lancés au doigt (fiche, confirmation, argent exact),
reprise visible saison après saison (50 % puis étape atteinte, 2 saisons pour une étape 1) ; avantages constatés sur l'état
réel (chauffage × 0,5, entretien × 0,9, cueillette des haies × 1,5, canicule ¼ → ½, 3 greffons de Reinette) ; martin-pêcheur
venu, ouvert depuis « À faire », touché dans la vue (« Bienvenue, petit martin-pêcheur ! »), récit d'Hélène, page « Le
carnet d'Hélène » ; pêche au ponton (fenêtre à 34 % de l'écran, 2ᵉ pêche refusée) ; deux champignons cueillis ; étapes 6
et 7 (ruban, brume, banc du belvédère, « L'eau revient » + 0,1 jour) ; trois terres confiées en mode terres sauvages (zoom
tactile × 4 posé puis rendu, bois / marais / prairie, prix 2 500 · 2 800 · 3 100), reprise 1 → 1 → 2 sur trois saisons,
carte, mini-carte, grande carte et fiche ; cerisier et poirier plantés et cueillis au doigt (jamais au grenier) ; « À
faire » : 11 entrées brutes → 5 ; une seule bulle au tableau avec un troc (« Choisir une graine » jamais couvert) ; succès
« La Vallée · n / 21 » dans la grange ; les quatre saisons de la vue (givre l'hiver) ; mouvement réduit (vue figée) et
texte 150 % ; niveau 1 en Détente et en Classique sans aucune trace. Cibles isolées de la scène mesurées au zoom minimal par
de vrais `hitTest` à ± 23,5 px du centre : toutes ≥ 47 px (deux poteaux voisins se partagent la zone, le plus proche du
doigt gagne, comme le veut le contrat) ; cibles de la vue (lieux, bête, champignons, ponton) ≥ 48 px. Aucune erreur
console. Corrections et restes : `JOURNAL.md` (« Vallée V3 : intégration… »). Captures :
`scratchpad/screens/valley3-qa-*.png`.

### 17.13 Liens avec l'existant (sans doublon)

| Existant | Ce que le V3 en fait | Pourquoi pas un doublon |
|---|---|---|
| **Carte 2D des terrains** (16 au plus) | Après le 16ᵉ, les 18 cases de forêt restantes deviennent des terres sauvages (bloc sans clôture) | Plus aucun terrain à acheter : aucune concurrence avec l'achat |
| **Mini-carte, grande carte** | Couleurs et pictogrammes des terres sauvages ; cases « à confier » | Même dessin que les terrains à vendre, en vert |
| **Veillées** (lot 4) | La 3ᵉ (le ruisseau, les écrevisses) et la 9ᵉ (les cigognes, V4) trouvent leur écho ; inchangées | Les récits du V3 sont propres à la carrière |
| **Pêche de la mare** (lot 2) | Inchangée ; la pêche au ruisseau s'ajoute (une par jour, flux `valley3`) ; l'étang × 1,15 vaut pour les deux | Un 2ᵉ endroit, pas un 2ᵉ système |
| **Moulin** (atelier) | + 1 place avec le moulin à eau | Même mécanisme que la place de fromagerie d'Anselme (lot 3) |
| **Serre chauffée, entretien des animaux, ruches, touristes, abris, corbeaux, cueillette des haies, trouvailles d'hiver, jachère** | Leviers des avantages des lieux | Aucune mécanique nouvelle |
| **Habitants du V1 et du V2** | Conditions des étapes (geai, écureuil, chouette, bourdons, osmie, libellules, pipistrelle, hérisson, merle…) | Ils prennent un sens nouveau, sans service de plus |
| **Variétés du V1 et du V2** | Calville et Api étoilé sauvés ouvrent le verger ; la Reinette grise s'ajoute | Règles du V1 (greffons) |
| **Pommier, dessins de la phase B** | Cerisier et poirier plantables (hors de `CROPS`) | Liste à part comme les graines rares |
| **Années à thème** (lot 3) | **Écartée au V3** : « L'année de la vallée » changerait le tirage du thème (flux `variety`) ; Hélène vient par un récit | Aucun flux existant ne bouge |
| **Album, succès** | 2 pages nouvelles, 8 succès | Règle du V1 |
| **Rangs, patrimoine** | 100 % au patrimoine ; aucun objectif de rang ne dépend du V3 (le rang 6 est déjà atteint) | Règle du V1 |
| **Lanternes** | Inchangées (la beauté garde son plafond de 6 points nature) | — |

### 17.14 Cas limites

| Cas | Ce qui se passe |
|---|---|
| Ferme sans mare, sans verger, sans grenier ou sans chêne | Les étapes qui en dépendent attendent ; la fiche du lieu dit quoi faire (« Il faut une mare : aménagez un terrain en mare ») ; rien n'est bloqué pour toujours. |
| La condition n'est plus remplie pendant la reprise | La reprise va à son terme (la condition se lit au lancement seulement). |
| Chantier lancé la veille de la fin d'une saison | La reprise compte en jours (saisons × durée des saisons de la carrière) : 1 saison = 7 jours (10 ou 14). |
| Reprise à cheval sur la fin d'année, sauvegarde et reprise de partie | `readyAt` est un jour absolu : rien ne change. |
| Bête de la vallée venue, le joueur ne vient jamais | Elle attend sans limite ; l'étape suivante attend aussi (la fiche le dit, « Voir » mène à elle). |
| Ancienne carrière riche (an 20, 500 000) reprise à l'étape 5 | Récit et poteau à la première aube ; elle peut lancer les 6 premiers chantiers d'un coup (son choix) ; les conditions et les reprises gardent le rythme ; terres sauvages confiables d'un coup si elle a 16 terrains. |
| Carrière à l'étape 4 qui a déjà 16 terrains | Ni vue ni terres avant l'étape 5 (la fiche « La Vallée » dit « La vallée s'ouvrira quand elle chantera »). |
| Carrière avec moins de 16 terrains, à jamais | Pas de terres sauvages ; les 6 lieux et les étapes 6 et 7 restent possibles (l'étape 7 se joue sans terres : 76 signes sur les 81 possibles sans elles — 99 moins 18). |
| Anciennes carrières à terrains empilés en colonne 0 (rangées 7 à 12) | Seules les cases de la grille (colonnes −2 à 2, rangées 0 à 6) non possédées sont des forêts à confier ; les terrains hors grille ne changent pas. |
| Une case sauvage, et un jour le nombre de terrains grandit (évolution future) | Une case sauvage n'est **jamais** à vendre (règle écrite dans le cœur : `frontierCells` l'ignore). |
| Pêche au ruisseau un jour où l'on a déjà pêché à la mare | Permis : ce sont deux pêches différentes. |
| Champignons non cueillis à la fin de l'automne | Ils partent avec l'automne (comme les mûres) ; ils reviennent l'automne suivant ; aucun message de regret. |
| Fêtes, tableau, thèmes désactivés (tests) | Le V3 ne dépend d'aucun d'eux. |
| Saisons de 10 ou 14 jours | Reprises et terres en saisons (converties en jours par la durée des saisons) ; rien en jours de 7. |
| `createCareer({ valley: { places: false } })` ou `{ heritage: false }` | V1 + V2 exactement (ou V1 seul) : aucun tirage `valley3`, aucun champ du V3 utilisé, étape 5 au plus. |
| Mode Niveaux | Rien (aucun champ, aucun flux) ; deux pages d'album visibles dans la grange (« À découvrir dans Ma ferme »). |

### 17.15 Ce qui change par rapport à l'aperçu du § 11.3

| Aperçu | Conception V3 | Pourquoi |
|---|---|---|
| Chantiers ≈ 175 000 ; terres 4 000 + 800 × n (≈ 194 000) | **160 000** ; **2 500 + 300 × n (90 900)** ; total ≈ 251 000 | Le joueur tranquille dispose de ≈ 290 000 des ans 9 à 18 : 369 000 finiraient vers l'an 20-21 (décision : vers l'an 18) |
| Conditions « 1 an », « 2 ans » seules pour certaines étapes | Chaque étape a une **condition de vie** (un habitant ou un aménagement) **et** une reprise (1, 2 ou 4 saisons) | Décision « chantier + condition + reprise » appliquée à toutes les étapes |
| Ru 2 : « 2 jachères dans l'année » | **4 jachères fleuries en tout** | Aucun compteur annuel (rien n'expire) |
| Ru 2 : « une 2ᵉ pêche par jour » | **Pêche au ruisseau**, au ponton de la vue, flux `valley3` | Le flux `events` ne tire pas un nombre de plus ; marche sans mare |
| Étang : « touristes + 15 % ; poissons de l'étang » | Poissons + 15 % (étape 1), touristes + 10 % (étape 2), abris + 5 % (étape 3) | Un avantage par étape, plafonnés |
| Prairie : « foin − 10 % » seulement | + ruches (étape 2) et sol vivant + 30 % (étape 3) | Un avantage par étape |
| Verger : Reinette grise, cerisier, poirier « pour vos vergers » | Reinette = **variété ancienne** (greffons, à sauver) ; cerisier et poirier = **arbres nouveaux hors de `CROPS`** (étapes 2 et 3) | Reinette dans le système des graines ; les arbres sans changer de tirage |
| Terres : « habitat pour les recettes (chevreuil : 2 bois) » | **Aucune recette** ne dépend des terres ; elles comptent comme signes de vie une fois reprises | Beaucoup de fermes n'auront jamais 16 terrains |
| Étapes 6 et 7 à 30 et 45 signes | **56** (+ Ru 2) et **76** (+ six lieux à l'étape 2) | L'étape 5 demande 38 signes depuis le V2 (§ 16.7) ; le V3 compte 48 signes de plus |
| Année à thème « L'année de la vallée » avec Hélène | **Écartée** ; Hélène arrive par un récit et tient « Le carnet d'Hélène » | Un thème de plus changerait le tirage du flux `variety` |
| « La vue … ouverte depuis la route en bas de la ferme et la fiche » | Poteau « Vers la vallée » + 4ᵉ segment **Lieux** + ligne « À faire » ; **pause** pendant la vue | Cosy, aucune course contre la montre |

### 17.16 Points à trancher (recommandation en premier)

1. **Taille du puits du V3** : (a) **≈ 251 000** (chantiers 160 000 + terres 90 900), vallée complète vers l'an 18
   (recommandé : tient la décision « vers l'an 18 » avec ≈ 45 000 en caisse à la fin) ; (b) les 369 000 de l'aperçu (fin vers
   l'an 20-21 pour le joueur tranquille) ; (c) ≈ 200 000 (fin vers l'an 16-17, l'argent dort de nouveau ensuite).
2. **Quand la vallée s'ouvre** : (a) à l'**étape 5** « La vallée chante » (recommandé : le récit s'enchaîne, vers l'an 9) ;
   (b) au **rang 6** (Domaine, vers l'an 7-8 : plus tôt, mais l'argent manque encore à la ferme et au V2) ; (c) à l'étape 4.
3. **Chantiers en même temps** : (a) **un par lieu**, les six en parallèle (recommandé : le joueur choisit son rythme) ;
   (b) deux chantiers à la fois au plus dans toute la vallée (plus étalé) ; (c) un seul à la fois.
4. **Les terres sauvages** : (a) **ne produisent rien**, sorte choisie une fois pour toutes (recommandé : « de la nature à
   accueillir », comme demandé) ; (b) une petite cueillette par terre reprise (bois : champignons, marais : cresson,
   prairie : miel sauvage) ; (c) réversibles (on peut changer de sorte).
5. **Parcelles au zoom minimal** : (a) zone de toucher = toute la case de la parcelle, et les modes de visée posent d'eux-mêmes
   le zoom tactile (recommandé : le joueur garde « toute la ferme visible ») ; (b) au zoom minimal, un premier toucher sur une
   parcelle rapproche la vue au lieu d'agir ; (c) relever le zoom minimal pour que les parcelles fassent toujours ≥ 48 px.
6. **Le temps dans la vue de la vallée** : (a) **il s'arrête** (recommandé : lecture tranquille, aucune perte) ; (b) il
   continue (la vallée vit pendant qu'on la regarde).

## Décisions de l'utilisateur sur le V3 (2026-10-03)

1. Puits : **≈ 251 000** (160 000 pour les lieux + 90 900 pour les terres sauvages), vallée finie vers l'an 18.
2. Ouverture de la vue de la vallée : **à l'étape 5** (vers l'an 9), avec le récit « Sur la colline ».
3. Chantiers : **un par lieu, les six en parallèle**.
4. Terres sauvages : **aucune production, sorte choisie pour toujours**.

Points non posés, tranchés selon la recommandation (§ 17.16) : zone de toucher = toute la case et zoom tactile automatique dans les modes de visée ; le temps s'arrête dans la vue de la vallée.

---

## 18. Lot V4 « Les cigognes » — conception détaillée (2026-10-04)

Conception complète du dernier lot de la Vallée ; elle **remplace l'aperçu du § 11.4** partout où les deux diffèrent
(écarts au § 18.15). Contrats de code : `docs/ARCHITECTURE.md`, « Vallée vivante — contrats du lot V4 ». Résumé :
`docs/GAME_DESIGN.md` § 18.3. Sauvegarde déjà faite : `backup/avant-vallee-v4-2026-10-04` (commit `ae003c1`).
Décisions déjà prises et suivies : tout restauré **vers l'an 18** pour le joueur tranquille ; dépenses de la Vallée à 100 %
au patrimoine ; le V4 est **décoratif** (aucun revenu, aucun service). Les chiffres sont des **valeurs de départ** réglées
ensuite par `tools/simulate-career.js --compare-valley4` ; la version qui fait foi vivra dans `src/data/career/storks.js`.

### 18.0 En bref

**L'idée.** La vallée est revenue ; le V4 lui rend **ses souvenirs** et **sa voix**. Les graines qui « dormaient trop
profond » se réveillent (le melon de la boîte en fer, l'engrain du moulin, la Merveille née chez vous, les pois de la
grand-mère), des **visiteurs rarissimes** passent dans la vallée et sur la ferme (les cigognes d'abord, sur le clocher
puis sur votre maison), la vallée **s'entend** enfin (ruisseau, moulin, chants des habitants installés, grenouilles et
grillons), et Joseph raconte **la fin de l'histoire** — sans fin de partie : la carrière continue, la vallée vit.

**En une phrase de jeu.** Le joueur lit qu'une graine se réveille, la **sème sous une cloche de verre** devant la
Grainothèque, la **récolte à la main** (aucune vente : on la partage), va **voir** les visiteurs rares quand ils font
halte (il faut les toucher, comme les habitants), lève les yeux vers le clocher au printemps, **écoute** la vallée, et
relit l'aventure dans **le livre de la vallée**.

**Ce que ça résout.**

| Constat (V3, § 17.12.8, et relecture du code) | Réponse du V4 |
|---|---|
| Les promesses du récit restent ouvertes : « le melon dort trop profond » (boîte en fer, § 2.1), les cigognes de la 9ᵉ veillée, l'étape 8 annoncée au § 6 | Le melon se réveille quand « l'eau revient » (la phrase de la mère de Joseph, chapitre 6) ; les cigognes reviennent « le même jour », comme le disait la grand-mère ; l'étape 8 et l'épilogue ferment l'histoire |
| **Les ambiances sonores promises n'ont jamais été faites** : « chant du matin » (étape 1), « la vallée qui chante » (étape 5), « le ruisseau s'entend » (étape 6) — le jeu ne joue aujourd'hui que le fichier `birds` générique, le même à l'étape 0 et à l'étape 7 | Un **paysage sonore vivant** en synthèse procédurale : la vallée se tait à l'étape 0, chaque habitant installé ajoute son chant, le ruisseau et le moulin s'entendent dans la vue (§ 18.8) |
| Après l'an 18 (vallée complète), plus rien de neuf | Visiteurs rares étalés des ans 16 à 22, légendes à ressemer, retour des cigognes chaque printemps (et leurs petits), cartes des vallées voisines, une page du livre par année (§ 18.11) |
| La forêt de la carte ne change plus après les clairières de l'étape 7 | Quatre états de la forêt de la carte, jusqu'à la **vieille forêt mêlée** de la vallée complète (§ 18.7) |

**Règles d'or du V4** (en plus de celles du § 0, du § 16.0 et du § 17.0) :

1. **Décoratif, vraiment.** Aucune vente, aucun service, aucun coût : une légende récoltée ne rapporte rien (on la
   partage), un visiteur n'ouvre rien, l'étape 8 ne donne aucun avantage (écus et décors seulement). Revenu et argent en
   caisse **identiques** au V3 (cible ± 0,5 %, attendu 0,0 %).
2. **Rien ne se perd, rien n'expire.** Un visiteur venu attend qu'on le voie ; une légende mûre attend sous sa cloche ; une
   carte postale attend qu'on la lise ; une saison manquée ne fait rien perdre (la suivante revient).
3. **Le joueur au centre.** Semer sous la cloche, récolter à la main, toucher un visiteur, lever les yeux vers le clocher :
   jamais l'équipe ni les machines. L'étape 8 attend que le joueur ait **vu** les cigognes.
4. **Aucune corvée, aucune envie fabriquée.** Rien à faire chaque jour ; aucune ligne « À faire » pour ressemer une légende
   (seulement « une légende est mûre ») ; aucune connexion quotidienne, aucun compte à rebours.
5. **Carrière seulement, niveaux identiques.** Rien en partie de niveau (Détente comme Classique), parité 400 / 400,
   `node tools/simulate.js` identique octet pour octet ; seules deux pages d'album nouvelles se voient dans la grange (« À
   découvrir dans Ma ferme »).
6. **Un seul flux nouveau, `valley4`** (les 5 visiteurs rares tirés au hasard) ; tous les flux existants (`valley`,
   `valley2`, `valley3`, `orders`, `variety`, `events`, `cozy`, `quality`, `surprise`, `sky`, `staff`, `career`, météo,
   marché) tirent exactement les mêmes nombres. Cigognes, légendes, cartes, oisillons, passages : déterministes (données,
   jours absolus, hachage pur).
7. **Le son ne porte jamais seul une information.** Tout ce qui s'entend se voit ou se lit aussi (message, dessin, fiche) ;
   « Sons de la vallée : coupés » ne fait rien perdre.

### 18.1 La boucle de jeu du V4

| Échelle | Ce que fait le joueur (de ses mains) |
|---|---|
| Quelques secondes | Toucher la cloche mûre → « Récolter à la main » ; toucher les grues qui font halte dans la prairie ; toucher les cigognes du clocher ; tourner une page du livre. |
| Une journée | Écouter le ruisseau dans la vue ; voir les vers luisants le long d'une haie, le soir ; semer une légende sous sa cloche. |
| Une saison | Une légende qui mûrit ; le retour des cigognes (printemps), leurs petits (été), leur départ (fin d'été) ; une carte d'une vallée voisine. |
| Une année | Un visiteur rare de plus ; la Merveille qui gagne une génération (été) ; une page du livre qui s'écrit. |
| Plusieurs années | Le melon (vers l'an 13), la Merveille (an 13 à 15), l'engrain et les pois (an 17), les cigognes au clocher (an 16 à 17) puis sur la maison (an 17 à 18), l'**épilogue vers l'an 18** ; ensuite les visiteurs rares jusqu'à l'an 20 à 22 et les cartes postales, sans fin imposée. |

Session type (an 18, printemps) : « 3ᵉ jour du printemps, le jour des cigognes. Message du matin : "Les cigognes sont
revenues sur la maison !". Je zoome sur le toit : le couple claque du bec. Sous la cloche du melon, les fleurs jaunes sont
là. Dans la vue, le ruisseau murmure à gauche, le moulin grince près de l'étang ; Joseph m'attend sur le banc : "Monte. Je
voulais la voir avec toi, une fois finie." »

### 18.2 Les quatre légendes (page d'album nouvelle « Les légendes »)

Une **légende** est une graine qui « dormait » et qu'un moment du récit réveille. Elle n'est pas une variété du § 3 : elle
n'a pas de trait, ne se sème pas aux champs, ne se vend jamais, ne compte pas comme signe de vie (les 99 signes restent
« toute la vallée »). Elle pousse **sous une cloche de verre**, devant la Grainothèque, et se récolte à la main pour le
plaisir et pour l'album.

| id | Légende | Culture (dessin) | Se réveille quand… | Récit de Joseph (vignette) | Petit texte (anecdote, ≤ 110 caractères) |
|---|---|---|---|---|---|
| `motherMelon` | **Le melon de la boîte** — Melon Petit Gris de Rennes (†) | melon | la vallée est à l'**étape 6** « L'eau revient » | `melon` « Le melon se réveille » (`story.melon` : la boîte ouverte, trois graines gonflées sur un linge humide) | Petit, gris et brodé dehors, orange dedans : on le disait trop sucré pour être vrai. |
| `millEinkorn` | **L'engrain du moulin** — petit épeautre (†) | blé | le Ru des Saules est à l'**étape 4** « Le moulin tourne » | `mill` « Le coffre du moulin » (`story.mill` : Joseph à genoux devant un coffre à grain ouvert) | Le plus vieux blé cultivé : ses épis fins nourrissaient déjà les premiers paysans. |
| `farmMarvel` | **La Merveille {de la ferme}** (« La Merveille de la Ferme des Tilleuls ») | tomate | **3 générations** de la Tomate croisée de la ferme : chaque été, une récolte **à la main**, belle ou dorée, de cette tomate compte une génération (une par été au plus) | `marvel` « La Merveille » (`story.marvel` : une tomate rayée d'or posée sur une assiette, Joseph ému) | Rayée d'or et de pourpre : trois étés de sélection à la main l'ont rendue unique au monde. |
| `storkPea` | **Les pois du jour des cigognes** — Pois Corne de bélier (†) | petits pois | les cigognes ont été **vues sur le clocher** (étape 8) | `peas` « Les pois du jour des cigognes » (`story.peas` : un sachet de toile, le clocher et deux cigognes au loin) | Un pois à rames aux gousses courbes : la grand-mère de Joseph le semait au retour des cigognes. |

Trois lignes de chaque récit (fenêtre des récits du V2, « Merci, Joseph », relisibles dans « Les récits de Joseph ») :

| id | Trois lignes |
|---|---|
| `melon` | « Ce matin, j'ai ouvert la boîte : trois graines de melon avaient gonflé. » · « Comme si elles avaient entendu le ruisseau revenir. » · « Ma mère disait : quand l'eau revient, tout revient. Sème-les près de tes bocaux. » |
| `mill` | « En rangeant le moulin, on a ouvert le vieux coffre à grain de mon père. » · « Au fond, une poignée d'engrain : le plus vieux blé du monde, disait-il. » · « Il a attendu soixante ans dans le noir. Il mérite un peu de soleil. » |
| `marvel` | « Trois étés que tu gardes les graines de ta plus belle tomate. » · « Elle ne ressemble plus à aucune autre : c'est la Merveille {de la ferme}. » · « Dans cent ans, quelqu'un la sèmera en disant ton nom. » |
| `peas` | « Ma grand-mère semait ses pois le jour où les cigognes revenaient. » · « Je les ai ressemés chaque printemps, en regardant le clocher vide. » · « Cette année, enfin, on les sème le bon jour. Tiens, ils sont à toi. » |

**Les cloches des légendes** (règles) :

| Règle | Valeur |
|---|---|
| Où | **4 cloches de verre** alignées devant la Grainothèque (une par légende, place fixe, dessinées par-dessus le bas de son rectangle) ; il faut la Grainothèque (niveau ≥ 1). Sans elle, la légende réveillée attend : « Le melon attend sa maison : la Grainothèque » |
| Semer | geste du joueur (fiche de la Grainothèque, segment **Légendes**, ou toucher la cloche) ; **gratuit** (la Grainothèque garde toujours les graines de légende : aucun stock) ; **toute saison** (sous cloche : pas de gel, pas d'arrosage) |
| Pousse | la durée de la culture en jours (melon 6, blé 4, tomate 5, pois 3), indépendante de la météo ; 3 dessins : semis, en fleur (à mi-pousse), mûre |
| Mûre | elle **attend** sous sa cloche, sans limite (ne pourrit, ne gèle, ne se perd jamais) ; ligne « À faire » douce : « Le melon de la boîte est mûr » |
| Récolter | **à la main seulement** (jamais l'équipe ni les machines) ; **aucune pièce**, aucun produit, rien au grenier ; la cloche redevient libre ; compteur de récoltes (livre, succès) |
| Première récolte | fenêtre courte : le fruit, une phrase (« Vous portez une tranche du premier melon à Joseph. Il ferme les yeux. »), case d'album « Les légendes » |
| Récoltes suivantes | message info : « Melon de la boîte récolté : la Grainothèque en garde les graines. » |
| Équipe, semoir, plan de culture, tableau, charrette, comice, troc | **jamais** (une légende n'existe pas pour eux) |

Phrases de la première récolte : melon « Vous portez une tranche du premier melon à Joseph. Il ferme les yeux. » ·
engrain « Une poignée de farine d'engrain : Paulo promet d'en faire une miche pour Joseph. » · Merveille « Vous coupez la
Merveille en deux : elle sent l'été tout entier. » · pois « Les premiers pois du jour des cigognes, croqués crus, au jardin. ».

**La Merveille, pas à pas.** Dès que la Tomate croisée de la ferme est **sauvée** (V2), la fiche de la variété et le
segment Légendes montrent « Gardez les graines d'une belle tomate de la ferme, une fois par été : 1 / 3 générations ». Une
récolte à la main de cette tomate, **belle ou dorée**, en été, fait « + 1 génération » (texte flottant) — une seule par été.
Un été sans belle récolte ne fait rien perdre. À la 3ᵉ génération, la Merveille se réveille (récit `marvel`). Son nom suit
le nom actuel de la ferme (règle `ofFarm` du § 16.4, jamais enregistré).

Calendrier visé (tranquille, médiane) : melon **an 13** (étape 6) ; Merveille **an 13 à 15** (Tomate croisée sauvée vers
l'an 11) ; engrain **an 17** (Ru 4) ; pois **an 17** (cigognes au clocher). **Une seule légende se réveille par aube** (les
récits attendent leur tour : rien ne s'entasse).

### 18.3 Six visiteurs rarissimes (page d'album nouvelle « Les visiteurs rares »)

Un **visiteur** n'est pas un habitant : il n'a aucun service, il n'ouvre aucune étape (sauf la cigogne, qui ouvre l'étape
8), il ne compte pas comme signe de vie. Il vient **quand la vallée est assez vivante pour lui**, rarement, fait halte, et
**attend qu'on vienne le voir** (même automate qu'au V1 : indice la veille, venue, il faut le toucher). Une fois vu, il
**revient de temps en temps** dans sa saison, en décor (hachage pur du jour), dans la vue et sur la ferme.

| id | Visiteur (accord) | Il vient quand… | Saisons | Où on le voit (la 1ʳᵉ fois) | Ensuite, en décor |
|---|---|---|---|---|---|
| `whiteStork` | Cigognes blanches (f, pl.) | **étape 7** + l'étang du moulin à l'étape ≥ 2 + la prairie des Coquelicots à l'étape ≥ 2 (des grenouilles et des sauterelles pour les petits) — **déterministe**, § 18.4 | printemps → été | sur le **clocher** du village (vue) | un nid sur **la maison** de la ferme, chaque printemps (§ 18.4) ; le couple du clocher aussi |
| `crane` | Grues cendrées (f, pl.) | la prairie à l'étape 3 (orchidées) + l'étang à l'étape 3 (roselière) | automne | halte dans la **prairie** (vue) | vol en V au-dessus de la ferme, quelques jours d'automne ; halte dans un **marais** (terre sauvage) s'il y en a |
| `redDeer` | Cerf élaphe (m) | le bois de la Combe à l'étape 3 **depuis 4 saisons** | automne | à la **lisière du bois** (vue), au crépuscule | le soir d'automne, au bord d'une terre sauvage **bois**, ou à la lisière de la carte |
| `oriole` | Loriot d'Europe (m) | le verger conservatoire à l'étape 3 **depuis 4 saisons** | été | dans le **verger** (vue) | l'été, dans un verger de la ferme |
| `beaver` | Castor d'Europe (m) | le Ru des Saules à l'étape 4 + le bocage à l'étape 3 (les vieux saules) | printemps → automne | près du **pont du ruisseau** (vue) ; son petit **barrage** se dessine | il reste : barrage et hutte dans la vue, toute l'année |
| `glowworms` | Vers luisants (m, pl.) | **étape 7** + **20 haies** sur la ferme | été | au pied d'une **haie de la ferme**, le soir (petites lueurs vertes) | chaque soir d'été, le long des haies de la ferme (et dans la prairie de la vue) |

| Visiteur | Indice (la veille) | Anecdote (≤ 110 caractères) | Titre de la fenêtre |
|---|---|---|---|
| Cigognes | (aucun : elles arrivent le jour dit, § 18.4) — message : « Deux grands oiseaux blancs tournent au-dessus du clocher ! » | Elles ne chantent pas : elles claquent du bec, tête renversée, pour se saluer. | « Les cigognes sont revenues ! » |
| Grues | « Des cris de trompette, très haut, dans le ciel d'automne… » | Les grues voyagent en famille et se parlent en vol, avec des cris de trompette. | « Les grues font halte dans la prairie ! » |
| Cerf | « Un grand bramement, au crépuscule, du côté de la vieille futaie… » | Chaque printemps, le cerf perd ses bois ; ils repoussent plus grands. | « Un cerf à la lisière du bois ! » |
| Loriot | « Un sifflement flûté, "dudeli-o", tout en haut des vieux pommiers… » | Jaune d'or, il vit tout en haut des arbres : on l'entend bien plus qu'on ne le voit. | « Le loriot chante au verger ! » |
| Castor | « Des branches de saule rongées en pointe, au bord du ruisseau… » | Presque disparu de France, il revient : ses barrages gardent l'eau des ruisseaux. | « Un castor au ruisseau ! » |
| Vers luisants | « Hier soir, une petite lumière verte au pied d'une haie… » | Les soirs d'été, la femelle allume sa lanterne pour que le mâle la trouve. | « Des vers luisants le long de la haie ! » |

**Venue (les 5 visiteurs tirés au hasard ; flux `valley4`).** Une fois la vue de la vallée ouverte (V3), **5 nombres par
aube** (un par visiteur, dans l'ordre des données : grues, cerf, loriot, castor, vers luisants), qu'il soit candidat ou non.
Conditions remplies et saison : **6 %** de chances par aube qu'il s'annonce (indice), puis 50 % par aube qu'il soit là (au
plus tard la 3ᵉ aube) ; il **reste jusqu'à ce qu'on le touche**, même si la saison change (la fiche dit alors « Les grues se
reposent encore dans la prairie »). **Une seule venue annoncée par aube toutes espèces confondues** (si un habitant du V1, du
V2 ou du V3 s'est annoncé ce matin, les visiteurs attendent : aucun tirage en moins ni en plus). Avec des saisons de 7
jours, un visiteur d'une seule saison vient en moyenne **deux à trois ans** après que sa condition est remplie : rare, mais
jamais perdu (levier : 6 % → 4 à 10 %, § 18.12).

**Toucher un visiteur** (cible ≥ 48 px ; ligne « À faire » « Des grues font halte dans la prairie » → la vue s'ouvre et
défile jusqu'à elles) : fenêtre d'observation du V1 (feuille basse, le visiteur recentré au-dessus) — dessin 64 px, titre,
anecdote, « ✓ Les visiteurs rares », bouton « Quelle chance ! » (≥ 56 px). Son : l'appel du visiteur (§ 18.8).

Calendrier visé (tranquille, médiane) : vers luisants **an 16 à 17**, cerf **an 17 à 18**, cigognes **an 16 à 17**, loriot
et castor **an 18 à 19**, grues **an 19 à 20** ; **6 / 6 vers l'an 21 à 22** (contenu de l'après-an 18, § 18.11).

### 18.4 Les cigognes et l'étape 8

**Le jour des cigognes.** « Elles revenaient chaque printemps, le même jour » (9ᵉ veillée) : chaque carrière a **son** jour
des cigognes, fixé une fois pour toutes par hachage de la graine (2ᵉ, 3ᵉ ou 4ᵉ jour du printemps, quelle que soit la durée
des saisons). Aucune part de hasard au-delà.

1. **Premier printemps au clocher.** Le jour des cigognes du premier printemps où les conditions sont remplies (étape 7,
   étang ≥ 2, prairie ≥ 2) : message important « Deux grands oiseaux blancs tournent au-dessus du clocher ! » · « Voir » ;
   résumé du matin ; ligne « À faire » `vl-storks` « Les cigognes sur le clocher ». Dans la vue, le couple est sur le
   **clocher** (en bas à droite, au bout du chemin du village) avec un « ? ». Il attend sans limite.
2. **On les touche** → fenêtre « Les cigognes sont revenues ! » (dessin, anecdote, « ✓ Les visiteurs rares »), son du
   claquement de bec. À l'aube suivante, **étape 8** et **chapitre 8** :

   > « Regarde le clocher. Non, regarde bien. »
   > « Deux cigognes. Ma grand-mère avait raison : elles reviennent le même jour. »
   > « Soixante-dix ans que je regarde ce clocher en mars, petit. »

   Après « Merci, Joseph » : **la roue à cigognes** se pose sur la cheminée de votre maison (cadeau de Joseph : une vieille
   roue de charrette, comme on en posait autrefois pour inviter les cigognes ; aucun coût, aucun emplacement à choisir).
   À l'aube d'après : le récit `peas` (les pois du jour des cigognes).
3. **Le printemps suivant, sur la maison.** Au jour des cigognes de chaque printemps qui suit l'étape 8 : le couple arrive
   **sur la roue de la maison** (le premier : récit `storkNest` « Un nid sur la maison »). Puis, chaque année :
   - **1ᵉʳ jour de l'été** : les cigogneaux (1 à 4, hachage pur de la graine et de l'année), visibles au bord du nid ;
   - **dernier jour de l'été** : départ (« Les cigognes sont parties vers le sud. Elles reviendront le 3ᵉ jour du
     printemps. ») ; l'automne et l'hiver, le nid vide (neigé l'hiver) ;
   - le livre note chaque année (« An 19 · retour le 3ᵉ jour du printemps · 3 cigogneaux »).

| id | Trois lignes (récit `storkNest` « Un nid sur la maison », vignette `story.storkNest`) |
|---|---|
| `storkNest` | « Elles ont choisi ta maison ! » · « Ma grand-mère disait qu'une cigogne sur le toit, c'est une maison heureuse. » · « Je crois qu'elles savent ce qu'elles font. » |

| Étape | Nom | Condition | Ce qui change (ferme et vue) | Ce que la vallée vous rend | Chapitre |
|---|---|---|---|---|---|
| 8 | Les cigognes | les cigognes **vues** sur le clocher (aucun palier de signes : les 99 restent « toute la vallée ») | cigognes au clocher (vue), roue puis nid sur la maison (ferme), vols de cigognes au printemps ; la forêt de la carte passe à l'état 3 quand la vallée est complète (§ 18.7) | **100 écus** ; la roue à cigognes ; vignette `valley.stage.8` ; aucun avantage de production | « Les cigognes » (ci-dessus) |

**Pourquoi pas le chantier du clocher (aperçu du § 11.4).** Un chantier de 10 000 sur le clocher serait la restauration
d'un **bâtiment public** « contre de l'argent », exactement ce que le § 0 écarte (« pas Stardew ») ; les cigognes
reviennent parce que **la vallée les nourrit** (prairie, étang) : c'est la même logique que les lieux du V3. La roue sur la
maison reprend un vrai geste paysan, offert par Joseph. (Point à trancher, § 18.16.)

### 18.5 L'épilogue de Joseph et la fin douce

**Quand.** La **vallée est complète** quand les **six lieux sont restaurés** (19 étapes) **et** que les cigognes **nichent
sur la maison** (étape 8 passée, un printemps). Les terres sauvages ne sont **pas** demandées (beaucoup de fermes n'auront
jamais 16 terrains, règle du V3). À la première aube où c'est vrai : message « Joseph vous attend sur la colline » et ligne
« À faire » `vl-epilogue` ; Joseph s'assoit sur le banc du belvédère de la vue (le toucher ouvre l'épilogue). Il attend
sans limite. Tranquille : **vers l'an 18**.

**L'épilogue « La vallée retrouvée »** — trois pages (fenêtre des récits, « Suivant ›» puis « Merci, Joseph » ; ne se ferme
pas d'un toucher dehors ; pause) :

| Page | Vignette (48 × 32) | Trois lignes |
|---|---|---|
| 1 | `story.epilogue.1` : la colline au soir, Joseph et le fermier assis, la vallée verte, deux cigognes | « Monte. Je voulais la voir avec toi, une fois finie. » · « Le ruisseau chante, le moulin tourne, les cigognes sont sur ta maison. » · « La vallée de ma mère, petit. Exactement comme elle me la racontait. » |
| 2 | `story.epilogue.2` : Joseph tend la boîte en fer | « Tiens. La boîte en fer. Elle est à toi, maintenant. » · « J'y ai mis un peu de chaque graine : les tiennes, celles du village, les légendes. » · « Une graine qu'on donne, c'est une graine qui vit. Tu sauras à qui la donner. » |
| 3 | `story.epilogue.3` : Joseph et Hélène sur le banc, le fermier qui redescend | « Moi, je vais m'asseoir un peu sur ce banc, avec Hélène. » · « On comptera les hirondelles. Viens nous voir quand tu veux. » · « La vallée n'a plus besoin qu'on la sauve. Elle a juste besoin qu'on y vive. » |

Puis, petite feuille : « Regarder la vallée » (le générique, ≥ 56 px) · « Plus tard » (≥ 48 px ; le générique reste dans le
livre).

**Le générique doux « La vallée de {la ferme} ».** La vue de la vallée, **au soir** (teinte dorée posée par le code), défile
seule et lentement du ciel jusqu'à la ferme (≈ 70 s) ; la **musique s'éteint** en 3 s et **seule la vallée s'entend**
(paysage sonore complet, § 18.8 — l'écho du chapitre 5 : « Écoute. ») ; quand un lieu passe, une carte discrète (16 px,
2 lignes au plus) dit son nom et la phrase de Joseph de sa dernière étape ; à la fin, « 26 habitants · 36 variétés · 6 lieux
· 4 légendes » puis « Merci d'avoir rendu sa vallée à la mère de Joseph. » et « La vallée continue. ». Toucher = pause /
reprise ; « Passer » (≥ 48 px) toujours visible ; mouvements réduits : pas de défilement, une carte par toucher. Le temps du
jeu est **en pause** pendant tout le générique.

**Après.** Rien ne s'arrête : la carrière continue, les saisons tournent. La boîte en fer du perron porte un ruban doré
(`valley.box.gift`) et ouvre désormais **le livre de la vallée** ; Joseph et Hélène sont assis sur le banc de la vue (décor,
le toucher donne une phrase de saison, § 18.11) ; Joseph garde ses veillées, ses quêtes, ses cœurs et son prêt (inchangés).
Décor offert « La boîte en fer » (`iron.box`, petit, sur un tabouret) ; succès « Le livre de la vallée ». **Joseph ne part
pas, ne meurt pas** : il se repose.

### 18.6 Le livre de la vallée (récapitulatif à relire)

Ouvert par : un bouton « Le livre » dans l'en-tête de la fiche « La Vallée » (dès le V4, à toute étape), la boîte en fer
(après l'épilogue), la ligne de la page « Plus loin » d'une carte arrivée. **Feuille plein écran**, pause, pages qu'on
tourne au doigt (glisser à gauche / à droite) ou avec « ‹ » / « › » (≥ 48 px, en bas, à portée de pouce) ; « Sommaire » (≥
48 px) ; lecteurs d'écran : chaque page est un titre et une liste.

| Page | Contenu |
|---|---|
| Couverture | « La vallée de {la ferme} », vignette de l'étape actuelle × 3, « depuis l'an 2 », bouton **« Partager »** (image locale, § 18.10) |
| Avant / après | la vignette de l'année où la Vallée a commencé à côté de celle d'aujourd'hui ; « 0 → 99 signes de vie » |
| Une page par année | « An 9 · La vallée chante » ; 3 à 6 lignes au plus, les premières fois de l'année (« Le hérisson s'installe », « Tomate Cœur de bœuf sauvée », « Le Ru des Saules : un filet d'eau », « Retour des cigognes le 3ᵉ jour du printemps · 3 cigogneaux ») ; une **phrase d'Hélène** en bas (au hasard pur de l'année, parmi 12) |
| Les graines | grille des 36 variétés + 4 légendes (bocal, nom, « sauvée l'an 7 ») |
| Les habitants et les visiteurs | grille des 26 habitants + 6 visiteurs (silhouette tant qu'ils ne sont pas venus) |
| Les lieux | les 6 lieux dans leur état actuel (vignette), « restauré l'an 16 » |
| Le calendrier de la vallée | quand revoir qui (seulement ceux déjà vus) : « Printemps, 3ᵉ jour : les cigognes » · « Automne : les grues, le brame du cerf » · « Soirs d'été : les vers luisants » · « Été : le loriot au verger » |
| Les récits | lien « Les récits de Joseph » (chapitres 0 à 8, récits du V2, du V3, du V4, épilogue) ; « Regarder la vallée » (le générique), une fois l'épilogue lu |
| Plus loin | les cartes des vallées voisines (§ 18.11) |

Les dates viennent des **jours absolus déjà gardés** (installations, variétés sauvées, étapes de lieux, terres sauvages) ;
le V4 garde en plus le jour de chaque étape de la vallée et, pour les anciennes carrières, le **reconstruit** depuis ces
dates (« vers l'an 9 »).

Phrases d'Hélène (12, ≤ 90 caractères) : « J'ai compté quarante-deux hirondelles sur le fil, ce matin. » · « Trois espèces de
chauves-souris au-dessus de l'étang. Trois ! » · « Le martin-pêcheur a niché sous la berge, près du pont. » · « Onze sortes
d'orchidées, et une douzième que je n'ai pas su nommer. » · « Les écrevisses ont fait des petits sous les cailloux. » · « La
chevêche m'a regardée passer sans bouger. On se connaît. » · « Le pic noir a creusé une nouvelle loge dans le vieux
hêtre. » · « Des traces de loutre jusqu'au moulin, dans la neige. » · « L'alouette chantait si haut que je ne la voyais
plus. » · « Les grenouilles ont chanté toute la nuit après l'orage. » · « J'ai vu un lièvre et un renard se regarder, puis
repartir chacun de son côté. » · « Mon carnet est presque plein. Il m'en faudra un autre. ».

### 18.7 Le paysage complet (ferme et vue)

**La forêt de la carte en quatre états** (les tuiles de forêt au-delà des terrains, sur la ferme, la mini-carte et la
grande carte — dessin seulement) :

| État | Quand | Ce qu'on voit |
|---|---|---|
| 0 « La forêt d'avant » | étape 0 à 4 | la forêt d'aujourd'hui, sombre et uniforme |
| 1 « La forêt s'éclaire » | étape 5 et 6 | une tuile sur cinq devient un feuillu (chêne, hêtre), lisière fleurie (V1) |
| 2 « Les clairières » | étape 7 | les clairières fleuries du V3 + deux feuillus sur cinq |
| 3 « La vieille forêt mêlée » | **vallée complète** (§ 18.5) | trois feuillus sur cinq : chênes, hêtres, bouleaux, merisiers en fleurs au printemps, roux et or à l'automne ; vieux arbres moussus et fougères ; parfois une biche à la lisière (décor) |

**La ferme, vallée complète** : le nid de cigognes sur la maison (printemps-été : le couple, puis les petits ; vols de
cigognes qui planent au-dessus du champ, 2 au plus) ; le vol en V des grues quelques jours d'automne (une fois vues) ; les
vers luisants le long des haies les soirs d'été (24 lueurs au plus) ; le cerf au bord d'un bois sauvage les soirs
d'automne ; le loriot dans un verger l'été ; un **arc-en-ciel** le matin qui suit une pluie, une fois sur trois (hachage du
jour ; dessiné par le code, mouvements réduits : fixe).

**La vue de la vallée, vallée complète** : les cigognes sur le clocher, le barrage du castor, le cerf à la lisière (soir
d'automne), les grues dans la prairie (automne), le loriot au verger (été), les vers luisants dans la prairie (soirs
d'été), **les fenêtres du village qui s'allument le soir**, Joseph et Hélène sur le banc ; un bouton **« S'asseoir sur le
banc »** (barre du bas, après l'épilogue) : la vue défile seule, très lentement, sans texte, avec le paysage sonore — un
moment de contemplation, à quitter d'un toucher.

**Vignette `valley.stage.8`** : la vallée complète au printemps, deux cigognes au-dessus du clocher.

### 18.8 Le paysage sonore de la vallée (plan sonore)

**Principe.** Tout est **synthétisé** dans le navigateur (Web Audio, comme `src/audio/synth.js`) : aucun fichier à
télécharger, aucune licence à vérifier, rien à ajouter à `CREDITS.md` pour ces sons (la ligne « sons synthétisés pour le
jeu, aucune ressource extérieure » y est ajoutée par souci de clarté). Les chants sont **stylisés** (comme le pixel art :
reconnaissables, jamais criards, gamme douce), pas des enregistrements. Tout passe par le **bus « Ambiance »** du joueur
(réglage « Ambiance » des options ; « Couper le son » coupe tout) ; seuls les sons d'événement (claquement des cigognes au
toucher, réveil d'une légende) passent par le bus des **effets**.

**Ce que la vallée fait entendre, et quand.**

*La couche de fond existante* (fichier `birds`, printemps-été) **suit l'étape** en carrière avec la Vallée commencée : × 0,25
à l'étape 0 (« la vallée s'est tue ») · 0,4 · 0,55 · 0,7 · 0,85 · × 1 dès l'étape 5. Pluie, vent d'hiver et abeilles : inchangés.
Hors Vallée (niveaux, carrière sans Vallée) : rien ne change.

*Les sons de nature* (synthétisés), chacun avec sa condition **et** son lieu :

| Son | Quand on l'entend | Où | Niveau (0 à 1) |
|---|---|---|---|
| **Murmure du ruisseau** | toute l'année (gelé l'hiver : plus doux) | vue : Ru ≥ 1 (filet : 0,3 ; ≥ 2 : 0,6 ; ≥ 3 : 0,8), plus fort quand le ruisseau est à l'écran ; ferme : étape ≥ 6, lointain (0,15) — « le ruisseau s'entend » | voir à gauche |
| **Roue du moulin** (grincement lent + éclaboussures) | toute l'année sauf l'hiver | vue : Ru 4, près de l'étang | 0,4 |
| **Vent dans les feuilles** | printemps → automne | vue : bois ≥ 2 ; ferme : étape ≥ 5 (l'hiver : le vent existant) | 0,25 |
| **Grillons et sauterelles** | été (fin de printemps), journée et soir | vue : prairie ≥ 1 ; ferme : terre sauvage prairie reprise, jachère fleurie, bande fleurie | 0,2 à 0,35 |
| **Grenouilles** | printemps, soirs d'été, plus fort après une pluie | vue : étang ≥ 1 ; ferme : grenouille rousse installée (mare) | 0,3 |
| **Abeilles** | inchangé (fichier existant, ruches) | ferme | — |

*Les chants* — un chant n'existe que si **l'espèce est installée** (ferme) ou **vue** (visiteur), dans ses saisons ;
fréquence de base en phrases par minute, × la phase du jour :

| Chant | Espèce | Phrases / min | Saisons | Moment fort | Où |
|---|---|---|---|---|---|
| cascade aiguë de 6 à 10 notes | rouge-gorge | 1,5 | toute l'année | aube, soir | ferme |
| phrase flûtée lente | merle noir | 1 | fin d'hiver → été | soir | ferme |
| gazouillis rapides | hirondelles | 2 | printemps, été | journée | ferme (abris), vue (étang) |
| « hou… hou-hou-houuu » | chouette hulotte | 0,5 | toute l'année | soir | ferme |
| « kiou » | chouette chevêche | 0,6 | toute l'année | soir | vue (bocage) |
| tambour sec (15 à 20 coups) | pic noir | 0,4 | fin d'hiver, printemps | matin | vue (bois) |
| cri rauque | geai | 0,4 | automne | journée | ferme (chêne) |
| trille qui monte, longue | alouette des champs | 0,6 | printemps, été | aube, journée | vue (prairie) |
| « oup-oup-oup » | huppe fasciée | 0,6 | été | journée | vue (prairie) |
| sifflet bref « tiii » | martin-pêcheur | 0,5 | toute l'année | journée | vue (ruisseau) |
| croassement grave, rare | héron cendré | 0,15 | toute l'année | — | vue (étang) |
| « cou-cou » | (coucou, ambiance de printemps, étape ≥ 5 ; pas un habitant) | 0,3 | printemps | matin | ferme et vue |
| claquement de bec | cigognes (vues) | 0,5 | printemps, été | journée | ferme (nid), vue (clocher) |
| trompettes en chœur | grues (vues) | les jours de passage | automne | — | ferme (vol en V), vue (prairie) |
| « dudeli-o » flûté | loriot (vu) | 0,6 | été | matin | vue (verger), ferme (verger) |
| brame lointain | cerf (vu) | 0,3 | automne | soir | vue (bois), ferme (lisière) |
| « plouf » de queue, rare | castor (vu) | 0,15 | printemps → automne | soir | vue (ruisseau) |
| *(silence)* | vers luisants | — | — | — | (ils se voient, ils ne s'entendent pas) |

**Phases du jour** (d'après l'avancée de la journée) : **aube** (premier quart) — chœur du matin, chants × 2 pour le
rouge-gorge, le merle, l'alouette, le coucou ; **journée** — grillons, abeilles, hirondelles ; **soir** (dernier quart) —
chouettes, grenouilles, merle, brame. **Météo** : pluie et orage font taire les chants (grenouilles × 1,5 après la pluie) ;
neige : seuls le rouge-gorge, les chouettes et le ruisseau assourdi.

**Densité.** La vallée ne devient jamais une volière : au plus **12 voix** de nature en même temps (réglage « complets »),
**4** en « légers » ; deux chants identiques jamais à moins de 4 s ; quand beaucoup d'espèces sont là, chacune chante un peu
moins (fréquence totale plafonnée à ≈ 12 phrases par minute à la ferme, 16 dans la vue).

**Dans la vue de la vallée** (écran à part) : la **musique baisse** (× 0,6) et la vallée passe devant ; chaque son est
**placé** : le ruisseau à gauche, le verger et la prairie à droite (panoramique stéréo doux), plus fort quand son lieu est
au milieu de l'écran, plus faible quand on fait défiler loin (jamais à zéro : on entend toute la vallée, de loin). Un écho
léger (« l'espace de la vallée ») seulement en réglage « complets ».

**Réglage nouveau** (Options › Son, sous « Ambiance ») : **« Sons de la vallée : Complets · Légers · Coupés »** (défaut
« Complets » ; « Légers » pour les petits téléphones : couches continues et 4 voix, sans écho). « Coupés » garde l'ancien
comportement exact (fichier `birds` seul, sans le facteur d'étape).

**Respect de l'existant** : volume « Ambiance » (courbe au carré comme aujourd'hui), « Couper le son », pause quand
l'application passe en arrière-plan (contexte audio suspendu), déverrouillage au premier toucher ; rien ne joue avant.
Mouvements réduits : sans effet sur le son.

### 18.9 Ce que le V4 rend (récapitulatif)

**Aucun avantage de production.** Écus, décors, album, succès, paysage, sons, récits.

| Album (pages **nouvelles**, mode « carrière ») | Cases | Condition | Récompense |
|---|---|---|---|
| `legends` « Les légendes » | 4 | légende récoltée une première fois à la main | 30 écus + décor « La cloche à melon » (`melon.cloche`, petit) |
| `visitors` « Les visiteurs rares » | 6 | visiteur vu (touché) | 40 écus + décor « La girouette à la cigogne » (`stork.vane`, petit) |

« L'album complet » reste les 11 pages du lot 4. Album : 20 pages, 201 cases.

| Succès (catégorie « Carrière », écus seulement, rangés sous « La Vallée ») | Condition | Écus |
|---|---|---|
| `firstLegend` La graine qui dormait | une première légende réveillée | 10 |
| `legendHarvest` Récolte de légende | récolter une légende à la main | 10 |
| `fourLegends` Les quatre légendes | récolter les 4 légendes | 40 |
| `storksBack` Les cigognes | atteindre l'étape 8 | 40 |
| `storkNest` Une maison heureuse | les cigognes nichent sur la maison | 20 |
| `rareVisitor` Un visiteur rare | voir un premier visiteur rare (hors cigognes) | 10 |
| `allVisitors` Le ciel de la vallée | voir les 6 visiteurs rares | 40 |
| `valleyBook` Le livre de la vallée | lire l'épilogue de Joseph | 30 |
| `furtherAway` Semer plus loin | recevoir une première carte d'une vallée voisine | 10 |

Total : 210 écus (+ 100 écus de l'étape 8 et 70 écus de pages). Grange : « La Vallée · n / 30 ». Décors trouvés (3) :
`melon.cloche`, `stork.vane`, `iron.box` (l'épilogue).

### 18.10 Écrans du téléphone (portrait, 412 × 915 et 360 × 740)

Cibles ≥ 48 px, textes ≥ 14 px (12 px pour les mentions), pictogramme **et** mot, pause pendant la lecture, mouvements
réduits partout, lecteurs d'écran (« en fleur, encore 3 jours », « vu », « 2 générations sur 3 »).

#### 18.10.1 La Grainothèque : segment **Légendes** (4ᵉ segment) et 4ᵉ étagère

```
┌──────────────────────────────────────┐
│ La Grainothèque                   ✕  │
│ [ L'étagère ][ Croisements ][ Troc ][ Légendes ] │  4 segments ≥ 48 px (grille 2 × 2 sous 380 px à ≥ 130 %)
│ ┌──────────────────────────────────┐ │
│ │[cloche 48] Le melon de la boîte   │ │  ligne ≥ 72 px
│ │           Mûr !  [Récolter à la main]│ │  ≥ 48 px
│ ├──────────────────────────────────┤ │
│ │[cloche] L'engrain du moulin       │ │
│ │         En fleur · encore 2 jours │ │  barre lue « 50 % »
│ ├──────────────────────────────────┤ │
│ │[silhouette] La Merveille…         │ │
│ │  Endormie · 2 / 3 générations     │ │  « Une belle tomate de la ferme, une fois par été »
│ ├──────────────────────────────────┤ │
│ │[silhouette] ? (les pois)          │ │  « Quand les cigognes reviendront… »
│ └──────────────────────────────────┘ │
│ Sous cloche : toute saison, sans eau. │  12 px
└──────────────────────────────────────┘
```

- Légende réveillée, cloche libre : bouton **« Semer »** (≥ 48 px) ; la plante apparaît sous la cloche (son `plant`).
- Toucher une ligne → fiche de la légende (grand dessin, anecdote, « Réveillée l'an 13 · 4 récoltes »).
- **L'étagère** gagne une 4ᵉ rangée « Les légendes 2 / 4 » (bocaux à couvercle doré).
- **La Vallée › Graines** : un groupe replié « Légendes » (≥ 48 px, « 2 / 4 ») et la carte de la Grainothèque.

#### 18.10.2 Une légende se réveille (récit, puis popup ≤ 50 % de l'écran)

```
┌──────────────────────────────────────┐
│      [bocal doré qui s'ouvre 64 px]   │
│       Une légende se réveille !       │
│   Le melon de la boîte                │  16 px
│   Melon Petit Gris de Rennes          │  14 px
│ « Petit, gris et brodé dehors,        │
│   orange dedans… »                    │
│ ✓ Sous sa cloche, devant la Grainothèque │
│ [ Semer ]           [ Plus tard ]     │  ≥ 48 px
└──────────────────────────────────────┘
```

#### 18.10.3 Un visiteur (fenêtre d'observation, comme au V1, dans la vue ou sur la ferme)

```
┌──────────────────────────────────────┐
│        [grues 64 px]                  │
│  Les grues font halte dans la prairie !│
│ Elles voyagent en famille et se       │
│ parlent en vol, avec des trompettes.  │
│ ✓ Les visiteurs rares (3 / 6)         │
│ [        Quelle chance !        ]     │  ≥ 56 px
└──────────────────────────────────────┘
```

#### 18.10.4 Le livre de la vallée (feuille plein écran)

```
┌──────────────────────────────────────┐
│ Le livre de la vallée      Sommaire ✕ │  ruban ; « Sommaire » ≥ 48 px
│ ┌──────────────────────────────────┐ │
│ │          An 13                   │ │  20 px
│ │      L'eau revient               │ │  16 px
│ │ [vignette valley.stage.6 × 3]    │ │
│ │ · Le Ru des Saules chante         │ │  14 px, 6 lignes au plus
│ │ · Le melon de la boîte se réveille│ │
│ │ · La chevêche s'installe          │ │
│ │ « Le martin-pêcheur a niché sous  │ │  Hélène, italique 14 px
│ │   la berge, près du pont. »       │ │
│ └──────────────────────────────────┘ │
│  [ ‹ ]      page 14 / 26      [ › ]  │  ≥ 48 px, tiers bas
└──────────────────────────────────────┘
```

- **Partager** (couverture) : une image 1080 × 1350 composée sur place (nom de la ferme, avant / après, quatre chiffres) →
  la feuille de partage du téléphone (`navigator.share` avec un fichier) ; sinon « Enregistrer l'image ». Aucun réseau, aucun
  compte.

#### 18.10.5 Fiches et lignes existantes enrichies

- **En-tête de « La Vallée »** : vignette de l'étape 8, « 99 signes de vie sur 99 · Étape 8 · Les cigognes », bouton « Le
  livre » (≥ 48 px).
- **Segment Habitants** : groupe replié « Visiteurs rares » (6 lignes : silhouette ou dessin, saison, condition en lignes
  cochées — « ✓ La prairie aux orchidées · ✗ La roselière » —, « Ils font halte dans la prairie [Aller voir] », « Vu ✓ »).
- **Le prochain indice** (toujours un seul), ordre : bête ou **visiteur** à voir (ferme ou vallée) ; chapitre, récit ou
  **épilogue** ; troc ; bocal ; **légende mûre** ; **légende réveillée à semer** (une seule fois, à son réveil) ; planche
  mûre ; paire ; graines ; lieu prêt ; recette ; Grainothèque ; ce qui manque au lieu le plus proche ; terre sauvage ;
  **ce qui manque aux cigognes** (« Les cigognes viendront quand l'étang aura ses nénuphars ») ; étape suivante.
- **Ligne « À faire »** (famille « vallée », regroupée) : `vl-visitor` « Des grues font halte dans la prairie »,
  `vl-storks` « Les cigognes sur le clocher », `vl-legend` « Le melon de la boîte est mûr », `vl-epilogue` « Joseph vous
  attend sur la colline », `vl-postcard` « Une carte du Val-aux-Merles », `vl-story` (récits du V4). Jamais « ressemez ».
- **Résumé du matin** : « Les cigognes sont revenues sur la maison ! », « Hier soir, une petite lumière verte au pied d'une
  haie… » (indice), « 3 cigogneaux dans le nid ».
- **Messages** : importants — visiteur venu, cigognes, légende réveillée, épilogue (« Voir ») ; infos — légende mûre,
  récoltée, départ des cigognes, carte postale.
- **Bilan de l'année** (bloc « La vallée cette année ») : **avant / après** (vignette de l'année de départ et de cette année,
  × 1,5 côte à côte, tient sur 360 px), visiteurs vus, légendes, cigogneaux.
- **Options › Son** : « Sons de la vallée : Complets · Légers · Coupés » (trois boutons ≥ 48 px).
- **Conseils « première fois »** : `valley.legend` (« Une légende ne se vend pas : elle se garde, et se partage. »),
  `valley.visitor` (« Les visiteurs rares font halte : allez les voir, ils vous attendent. »), `valley.book` (« Tout ce que
  vous avez fait revivre est écrit ici. »), `valley.sounds` (« Écoutez : chaque habitant installé a son chant. »).

### 18.11 Après l'an 18 : la vallée continue (sans peur de rater, sans corvée)

Rien n'oblige à revenir ; tout ce qui vient attend. Ce qui reste à vivre :

| Contenu | Rythme | Pourquoi c'est doux |
|---|---|---|
| **Visiteurs rares** qui n'ont pas encore fait halte | ans 18 à 22 environ | ils attendent qu'on les voie ; aucun ne repart sans avoir été vu |
| **Le retour des cigognes**, le même jour chaque printemps ; les cigogneaux (1 à 4) ; le départ | chaque année | le livre note chaque année ; un rendez-vous, pas une obligation |
| **Les légendes** à ressemer sous leur cloche | quand on veut | aucune ligne pour le rappeler ; une cloche vide n'est pas un reproche |
| **Les cartes des vallées voisines** : envoyer un sachet de la boîte en fer à une vallée voisine (gratuit, un geste dans le livre, page « Plus loin ») ; sa carte arrive à la **première aube de la saison suivante** ; un seul sachet en route à la fois | 8 cartes, au rythme du joueur (≥ 2 ans) | la vallée fait des petits ; on envoie quand on veut, rien ne se perd |
| **Le livre** : une page de plus par année, la phrase d'Hélène | chaque année | un souvenir qui s'écrit seul |
| **Le banc** : Joseph et Hélène, une phrase de saison au toucher (16 phrases, 4 par saison, hachage du jour) ; « S'asseoir sur le banc » | quand on veut | de la compagnie, rien à faire |
| **Le générique** à revoir (livre) | quand on veut | — |

**Les huit vallées voisines** (ordre fixe ; carte 48 × 32 ; signataire ; une ligne) :

| # | Vallée | Carte (vignette) | Ce qu'elle écrit |
|---|---|---|---|
| 1 | Le Val-aux-Merles | une barrière, un merle, des pois à rames | « Vos pois ont levé ! Et ce matin, un merle chantait sur la barrière. » — Marthe, l'institutrice |
| 2 | Les Combes-Hautes | des cloches de verre dans un potager en pente | « Le melon a pris sous la cloche. Les enfants comptent les jours. » — la famille Roux |
| 3 | Saint-Aubin-des-Saules | une haie toute neuve, un hérisson | « On a replanté une haie, puis deux. Les hérissons sont revenus. » — Gaston |
| 4 | La Fontaine-Rousse | une source qui coule entre des pierres | « La source coule de nouveau. On a pensé à vous. » — les gens de la Fontaine |
| 5 | Le Moulin-Neuf | un moulin et une miche de pain | « Notre meunier fait du pain avec votre engrain. Il sent la noisette. » — Albert, meunier |
| 6 | Les Prés-Fleuris | un pré rouge de coquelicots, une silhouette aux jumelles | « Coquelicots partout cet été. Hélène est venue les compter ! » — Suzanne |
| 7 | Le Bois-Joli | un chevreuil dans un verger au petit jour | « Un chevreuil traverse le verger chaque matin, à sept heures pile. » — Paul et Jeanne |
| 8 | La vallée d'à côté | un clocher et une cigogne | « Cette année, une cigogne s'est posée sur notre clocher. Merci. » — tout le village |

(La 8ᵉ carte répond à votre propre histoire : c'est la dernière, sans « fin » annoncée.)

Phrases du banc (exemples, 4 par saison) : printemps « Elles sont arrivées le 3ᵉ jour, comme chaque année. » · été « Hélène
dit que les petits voleront avant la fin de l'été. » · automne « Tu entends les grues ? Elles passent toujours par ici. » ·
hiver « Le ruisseau fait moins de bruit sous la glace. Mais il est là. ».

### 18.12 Équilibrage

#### 18.12.1 Ce que le V4 change à l'économie : rien

| Élément du V4 | Effet économique | Pourquoi |
|---|---|---|
| Légendes | **0** | aucune vente, aucun produit, aucun grenier, aucune parcelle prise (sous cloche, hors champs) |
| Visiteurs, cigognes, étape 8 | **0** | aucun service ; l'étape 8 ne rend que des écus (cosmétiques) |
| Cartes, livre, banc, générique | **0** | — |
| Écus (étape 8, pages, succès : 380) | **0** sur la carrière | les écus n'achètent que des cosmétiques ; la carrière n'a aucun atout (`perks: {}`) |
| Flux `valley4` | **0** | aucun flux existant ne tire un nombre de plus ou de moins |
| Robots du V4 | **0** | décisions sur leur tirage propre (`me.storksRnd`) ; aucun appel des robots du V1 au V3 ne change d'ordre |

Donc : **revenu, argent en caisse, rangs, Domaine, faillites identiques au V3**. La simulation le vérifie par une
**empreinte économique** (argent jour par jour sur 24 ans) identique entre `{ storks: false }` et le V4 complet.

#### 18.12.2 Cibles du V4 (`--compare-valley4` : V1 + V2 + V3 → + V4, même graine ; 60 carrières × 24 ans, Détente, saisons de 7 jours)

| Mesure (tranquille, médiane sauf mention) | Cible |
|---|---|
| Revenu sur 18 et 24 ans | **± 0,5 %** du V3 (attendu : 0,0 %) |
| Argent en caisse aux ans 14, 18, 24 | ± 0,5 % (attendu : identique) |
| Rangs, Domaine | identiques |
| Faillites | **aucune** (Détente) ; Carrière Classique : 0 % (inchangé) |
| Melon / Merveille / engrain / pois | an 12 à 14 / an 13 à 16 / an 16 à 18 / an 16 à 18 |
| Cigognes au clocher (étape 8) | **an 16 à 18** ; ≥ 85 % des carrières à l'an 20 |
| Nid sur la maison | an 17 à 19 |
| Épilogue | **vers l'an 18** (an 17 à 19) ; ≥ 80 % des carrières à l'an 20, ≥ 95 % à l'an 22 |
| Visiteurs rares | ≥ 3 / 6 à l'an 18 ; ≥ 5 / 6 à l'an 20 ; 6 / 6 vers l'an 21 à 22 |
| Nouveautés après l'an 18 | ≥ 1 par saison dans ≥ 60 % des saisons des ans 19 à 24 (visiteur, carte, cigogneaux, légende, page du livre) |
| Gestes par jour (ans 13 à 24) | + 0,05 à + 0,3 (semer et récolter une légende, voir un visiteur) |
| `automator` | **aucun** visiteur vu, aucune légende récoltée, **pas d'étape 8**, pas d'épilogue (il ne touche rien) |
| `handsOff`, `handsOffLate` | bénéfice inchangé (± 0,5 %) |
| Appliqué | épilogue an 13 à 15 ; 6 / 6 visiteurs vers l'an 17 |
| Débutant | n'atteint pas le V4 en 24 ans dans la plupart des carrières (rien n'est perdu) |
| Niveaux ; `{ storks: false }` | **identiques** : `node tools/simulate.js` octet pour octet, parité 400 / 400 ; empreinte d'une carrière de 24 ans identique au V3 |

#### 18.12.3 Robots (par l'API publique et un tirage propre `me.storksRnd`)

- **Tranquille** : lit les récits (0 geste) ; un regard par saison sur la Grainothèque : sème chaque légende réveillée dont
  la cloche est libre (1 geste) ; récolte une légende mûre 70 % des jours joués (1 geste) ; voit un visiteur qui attend 70 %
  des jours où il ouvre la vue (ou sur la ferme pour les vers luisants) ; touche les cigognes du clocher 70 % ; lit
  l'épilogue (0) ; envoie un sachet à une vallée voisine chaque saison où aucun n'est en route (0, décision).
- **Débutant** : 30 % de tout cela. **Appliqué** : tout, dès que possible.
- **`automator`, `handsOff`, `handsOffLate`, `idle`** : rien (aucun geste) après leur dernière année jouée.

#### 18.12.4 Leviers si une cible n'est pas tenue (dans cet ordre)

Chance d'annonce des visiteurs (6 % → 4 à 10 %) ; « depuis 4 saisons » du cerf et du loriot (2 à 6) ; conditions des
cigognes (étape 7 seule, ou + roselière) ; générations de la Merveille (3 → 2) ; une condition de l'épilogue (nid sur la
maison → étape 8 seulement). **Jamais** l'économie, les chiffres des niveaux, le rythme des rangs ni les tirages d'un flux
existant.

#### 18.12.5 Performances (téléphone)

- **Rendu de la ferme** : forêt de l'état 3 posée dans la **couche fixe** (aucun coût par image ; la clé de la couche
  inclut l'état de la forêt) ; 2 cigognes en vol au plus, 1 vol de grues, 24 lueurs de vers luisants au plus (réserve de
  particules), arc-en-ciel en un dessin ; rien hors de la vue. Cible : **+ 0,5 ms par image au plus** sur le Pixel 7 émulé
  (mesure `__debug.valley4.stats()`).
- **Vue de la vallée** : 4 habitants et 3 visiteurs dessinés au plus, teinte du soir en un aplat, fenêtres du village en 4
  sprites.
- **Son** : un seul tampon de bruit partagé (2 s), **aucun** `ConvolverNode` (l'écho est un `DelayNode` bouclé), au plus 4
  couches continues et 12 voix (4 en « légers ») ; le programmateur tourne sur une minuterie de 250 ms (pas à chaque
  image) ; **tout s'arrête** (nœuds déconnectés) quand le volume « Ambiance » est à 0, le son coupé, l'application en
  arrière-plan ou le réglage « Coupés ». Cible : aucun craquement sur le Pixel 7 ; `audio.natureVoices` ≤ 16 nœuds-sources
  actifs en moyenne.

#### 18.12.6 Résultats et réglages (livraison CORE V4, 2026-10-04)

Mesure : `node tools/simulate-career.js --compare-valley4 --runs 60 --jobs 4` (Détente, saisons de 7 jours, 60 carrières ×
24 ans par robot, V1 + V2 + V3 exactement → + V4, mêmes graines). Médianes du tranquille sauf mention.

| Mesure | Cible | Mesuré |
|---|---|---|
| Revenu sur 18 et 24 ans | ± 0,5 % (attendu 0,0 %) | **+ 0,0 %** (tous les robots) |
| Argent de chaque jour (empreinte) | identique | **identique** : 40 320 jours × 7 robots, 0 jour différent |
| Argent en caisse ans 14 / 18 / 24 ; rangs ; Domaine ; faillites | identiques | identiques (33 358 / 55 640 / 321 106) ; Domaine an 7 ; 0 % |
| Melon / Merveille / engrain / pois | an 12-14 / 13-16 / 16-18 / 16-18 | an **13** / **13** / **17** / **17** |
| Cigognes au clocher (étape 8) | an 16-18 ; ≥ 85 % à l'an 20 | an **17** ; **97 %** |
| Nid sur la maison | an 17-19 | an **18** |
| Épilogue | an 17-19 ; ≥ 80 % à l'an 20 ; ≥ 95 % à l'an 22 | an **18** ; **97 %** ; **97 %** |
| Visiteurs vus | ≥ 3 à l'an 18, ≥ 5 à l'an 20, 6 vers l'an 21-22 | **4** ; **5** ; 6 / 6 à l'an **21** |
| Nouveautés après l'an 18 | ≥ 1 par saison dans ≥ 60 % des saisons des ans 19-24 | **64 %** des saisons (V4 seul) ; 79 % avec toute la Vallée |
| Gestes par jour (ans 13-24) | + 0,05 à + 0,3 | **+ 0,24** (V4 seul : 0,19) |
| `automator` | rien | aucun visiteur, aucune légende, pas d'étape 8 ni d'épilogue |
| `handsOff`, `handsOffLate` | bénéfice ± 0,5 % | + 0,0 % (rien du V4 après leur dernière année) |
| Appliqué | épilogue an 13-15, 6 / 6 vers l'an 17 | épilogue an **12**, 6 / 6 an **16** (plus tôt : son étape 7 arrive vers l'an 11) |
| Débutant | n'atteint pas le V4 en 24 ans | jamais (aucune carrière) |
| Carrière Classique (`--difficulty classique`, 12 carrières × 24 ans) | faillites inchangées | **inchangées** (tranquille et appliqué 0 % ; débutant 58 % → 58 %, comme avant le V4) ; argent identique chaque jour ; tranquille : cigognes an 20, épilogue an 21 |

Réglages : **aucun chiffre de jeu n'a changé** (6 % / 50 % / 3 aubes, 4 saisons pour le cerf et le loriot, 3 générations,
conditions des cigognes, 2ᵉ à 4ᵉ jour, 1 à 4 cigogneaux : valeurs de départ gardées). Seul le **robot** tranquille a été
précisé sur la mesure : il regardait ses cloches chaque saison et ressemait les 4 légendes (+ 1,1 geste par jour, hors de la
cible) ; il ne les regarde plus qu'avec une chance de 0,15 par saison (« quand on veut ») et envoie un sachet une saison sur
deux (les 8 cartes s'étalent sur ≈ 4 ans et nourrissent les saisons d'après l'an 18). Les robots du V4 tirent leurs
décisions sur `me.storksRnd` et passent après ceux du V1 au V3 : l'empreinte économique le prouve.

Reste à surveiller : 2 à 3 % des carrières tranquilles n'ont pas l'étape 8 à l'an 22, parce que leur **étape 7** (V3) arrive
tard ; aucun levier du V4 ne l'avance (les cigognes demandent l'étape 7). L'appliqué boucle le V4 vers l'an 12-16 (contenu
de l'après-an 18 : cigognes chaque printemps, cartes, livre).

### 18.13 Liens avec l'existant (sans doublon)

| Existant | Ce que le V4 en fait | Pourquoi pas un doublon |
|---|---|---|
| **Boîte en fer** (V1) | le melon promis se réveille ; à l'épilogue, Joseph vous la donne : elle ouvre le livre | la même boîte, la fin de sa promesse |
| **Veillées** (lot 4) | la 1ʳᵉ (le melon), la 9ᵉ (les cigognes) et la 12ᵉ (« la vallée chante ») trouvent leur réponse ; inchangées | les récits du V4 sont propres à la carrière |
| **Grainothèque** (V2) | 4 cloches devant elle, 4ᵉ segment, 4ᵉ étagère | pas de nouveau bâtiment |
| **Croisements** (V2) | la Tomate croisée devient la Merveille par sélection (3 étés) | la « 3ᵉ génération » de l'aperçu, en vrai geste paysan |
| **Lieux, vue de la vallée** (V3) | conditions des légendes et des visiteurs ; visiteurs, barrage, clocher, banc dans la vue ; générique et contemplation | aucun lieu nouveau, aucun chantier |
| **Habitants** (V1 à V3) | leurs chants dans le paysage sonore | ils prennent une voix, sans service de plus |
| **Ambiances** (`ambienceFor`) | la couche d'oiseaux suit l'étape ; sons de nature synthétisés par-dessus | les niveaux ne changent pas |
| **Synthé** (`synth.js`) | deux tons d'événement (claquement, réveil d'une légende) | même module, même bus |
| **Petits pois et melon** (graines rares du lot 3) | dessins de base des légendes ; le marché, Basile et les graines rares **ne changent pas** | une légende n'est pas une culture du marché |
| **Album, succès** | 2 pages nouvelles, 9 succès | règle du V1 |
| **Joseph** | 5 récits, chapitre 8, épilogue ; quêtes, cœurs, prêt inchangés | — |
| **Hélène** (V3) | ses phrases dans le livre, sur le banc | — |
| **Bilan annuel** | avant / après, visiteurs, légendes, cigogneaux | un bloc qui existe déjà |

### 18.14 Cas limites

| Cas | Ce qui se passe |
|---|---|
| Pas de Grainothèque | Les légendes se réveillent quand même (récit, album pas encore) ; « Le melon attend sa maison : la Grainothèque » ; dès le niveau 1, les cloches apparaissent. |
| Tomate croisée jamais trouvée ou jamais sauvée | La Merveille reste endormie (« Il faut d'abord sauver la Tomate de la ferme ») ; rien ne bloque l'épilogue (aucune légende n'est demandée). |
| Un été sans belle tomate de la ferme | Pas de génération cet été-là ; rien n'est perdu. |
| Moins de 16 terrains, à jamais | Tout le V4 reste possible (aucune condition sur les terres sauvages) ; les grues ne font simplement pas halte dans un marais de la ferme. |
| Visiteur venu, jamais touché | Il attend sans limite (la ligne « À faire » le garde, regroupée) ; ses chants n'existent pas tant qu'il n'est pas vu. |
| Cigognes du clocher jamais touchées | L'étape 8 attend ; pas de nid sur la maison ni d'épilogue ; aucune perte. |
| Cigognes vues en été (pas au printemps) | Étape 8 à l'aube suivante ; nid sur la maison au printemps qui suit. |
| Maison qui change de niveau (agrandissement) | Le nid suit la cheminée (ancre de chaque niveau, posée par le rendu). |
| Ancienne carrière riche (an 25, tout restauré, étape 7) à la mise à jour | Aucune rafale : **une** légende ou un récit par aube (melon, puis engrain…) ; cigognes au **prochain** jour des cigognes ; Merveille comptée à partir de l'été suivant ; épilogue après le nid. Le livre reconstruit les années passées (« vers l'an 9 »). |
| Saisons de 10 ou 14 jours | Jour des cigognes entre le 2ᵉ et le 4ᵉ jour ; pousse sous cloche en jours de culture ; visiteurs : plus de jours par saison, donc un peu plus tôt. |
| Son coupé, ambiance à 0, « Sons de la vallée : coupés » | Aucun nœud de synthèse créé ; tout se voit et se lit (messages, dessins, livre). |
| Petit téléphone qui peine | Réglage « Légers » ; le jeu ne baisse jamais la qualité de lui-même sans le dire. |
| Mouvements réduits | Cigognes posées (pas de vols), grues absentes du ciel (la fenêtre les montre), lueurs fixes, générique sans défilement (une carte par toucher), contemplation fixe. |
| `createCareer({ valley: { storks: false } })`, `{ places: false }`, `{ heritage: false }` | V1 + V2 + V3 exact (aucun tirage `valley4`, aucun champ du V4 utilisé, étape 7 au plus) ; ou les lots d'avant exactement. |
| `{ wildlife: false }` (tests) | Ni visiteurs ni cigognes : étape 7 au plus, pas d'épilogue ; légendes melon, engrain et Merveille possibles. |
| Mode Niveaux | Rien (aucun champ, aucun flux, aucun son nouveau) ; deux pages d'album visibles dans la grange (« À découvrir dans Ma ferme »). |

### 18.15 Ce qui change par rapport à l'aperçu du § 11.4

| Aperçu | Conception V4 | Pourquoi |
|---|---|---|
| Melon : « serre + Grainothèque N5 + 3 croisements réussis » | **Étape 6** « L'eau revient » (« quand l'eau revient, tout revient ») ; pousse sous cloche devant la Grainothèque | un moment du récit plutôt qu'une liste d'achats ; aucune serre requise |
| « Trois variétés de 3ᵉ génération (croisée × croisée) » | **Une** Merveille par sélection (3 étés de belles tomates de la ferme) + l'**engrain du moulin** + les **pois du jour des cigognes** | il n'existe qu'une croisée par culture (croisée × croisée n'a pas de sens dans la table du V2) ; chaque légende ferme un fil (la boîte, le moulin du père, votre nom, la grand-mère) |
| Cigogne : chantier du clocher, 10 000 | **Aucun chantier** : elles viennent quand la vallée les nourrit (étape 7, étang ≥ 2, prairie ≥ 2), le jour des cigognes ; Joseph offre la roue pour la maison | pas de bâtiment public restauré « contre de l'argent » (§ 0) ; décoratif |
| « Puis sur le Manoir » | sur **la maison**, quel que soit son niveau (le Manoir au Domaine) | toutes les fermes y ont droit |
| Grue, cerf, loriot | + **castor** et **vers luisants** (un visiteur de la ferme, le soir) ; cerf : « vieille futaie depuis 4 saisons » (pas les terres de bois) | des visiteurs étalés jusqu'à l'an 22 ; aucune condition sur les terres sauvages |
| Ambiance « sons CC0 listés dans `CREDITS.md` » | **synthèse procédurale** (aucun fichier) ; option « Sons de la vallée » | rien à télécharger, hors ligne, aucune licence ; point à trancher (§ 18.16) |
| Avant / après au bilan ; page partageable | avant / après au bilan **et** dans le **livre de la vallée** ; partage en image locale | le livre est la « fin à relire » demandée |
| — | **Épilogue** de Joseph, générique doux, banc, cartes des vallées voisines | la fin douce et l'après-an 18 |

### 18.16 Points à trancher (recommandation en premier)

1. **Les légendes** : (a) **sous quatre cloches devant la Grainothèque, jamais vendues** (recommandé : vraiment décoratif,
   un lieu à elles) ; (b) aussi semables aux champs comme une variété sans trait (vente au prix de la culture : le melon
   rapporterait, revenu + 0,1 à 0,3 %) ; (c) seulement dans l'album, sans geste.
2. **Les cigognes** : (a) **elles viennent d'elles-mêmes** quand la vallée les nourrit (clocher, puis la roue offerte sur
   la maison ; recommandé : aucun bâtiment public restauré, aucun coût) ; (b) chantier du clocher à 10 000 (l'aperçu : un
   petit puits de plus) ; (c) une roue à cigognes à acheter et à poser soi-même (≈ 2 000).
3. **Les sons de la vallée** : (a) **tout en synthèse procédurale** (recommandé : rien à télécharger, hors ligne, aucune
   licence, style « pixel » cohérent) ; (b) hybride : synthèse + 5 ou 6 enregistrements CC0 de Freesound pour les chants
   difficiles (merle, alouette, grues), ≈ 1,5 Mo, listés dans `CREDITS.md` ; (c) enregistrements seulement.
4. **La couche d'oiseaux existante** : (a) **elle suit l'étape** (× 0,25 à l'étape 0 → × 1 à l'étape 5 ; recommandé : « la
   vallée s'est tue » s'entend, et chaque habitant compte) ; (b) inchangée, les chants du V4 s'ajoutent seulement.
5. **La fin douce** : (a) **épilogue en 3 pages + générique sur la vallée au soir**, puis Joseph se repose sur le banc
   avec Hélène et la carrière continue (recommandé) ; (b) épilogue seul, sans générique ; (c) une « fête de la vallée »
   jouable (moteur des fêtes du lot 4 ; plus long à faire).
6. **Après l'an 18** : (a) **visiteurs étalés, cigognes chaque printemps, légendes à ressemer, 8 cartes des vallées
   voisines, une page du livre par an** (recommandé) ; (b) idem sans les cartes postales ; (c) en plus, un nouveau puits
   décoratif (ouvrages « pour la beauté », ≈ 30 000).
7. **La mère de Joseph** : (a) **reste « ma mère »**, sans prénom (recommandé : pudeur, chacun l'imagine) ; (b) on lui
   donne un prénom (« le melon de Jeanne »).

## Décisions de l'utilisateur sur le V4 (2026-10-04)

1. Légendes : **sous les cloches de verre**, jamais vendues (aucun effet économique).
2. Cigognes : **viennent d'elles-mêmes** (clocher à l'étape 8, puis roue offerte par Joseph sur la maison).
3. Sons : **entièrement synthétisés par le jeu** (Web Audio), réglage « Sons de la vallée » Complets / Légers / Coupés.
4. Fin douce : **épilogue de Joseph puis générique**, Joseph se repose ensuite sur le banc avec Hélène ; la carrière continue.

Points non posés, tranchés selon la recommandation (§ 18.16) : la couche d'oiseaux existante suit l'étape ; après l'an 18 : visiteurs étalés, cigognes chaque printemps, légendes, 8 cartes postales et le livre ; la mère de Joseph reste « ma mère », sans prénom.
