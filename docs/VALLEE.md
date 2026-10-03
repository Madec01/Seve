# La Vallée vivante — conception (2026-10-03)

Le **grand projet long du mode Carrière** : la Vallée qui revient (faune, paysage) et la Grainothèque vivante (variétés
anciennes), réunies en un seul fil, raconté par Joseph. Choix de l'utilisateur (2026-10-02, confirmé le 2026-10-03) ;
idéation : `docs/analyse/5-idees-projet-long.md` § 4. Contrats de code du lot V1 : `docs/ARCHITECTURE.md`, « Vallée
vivante — contrats du lot V1 » ; lot V2 « Le troc et les croisements » : conception détaillée au **§ 16**, contrats « Vallée
vivante — contrats du lot V2 ». Résumé : `docs/GAME_DESIGN.md` § 18.

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
- Le melon de la mère de Joseph est une promesse : il germera au lot V4 (§ 11.4).

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
terre sauvage). Le compte n'est **pas** un score affiché en gros : la fiche montre une rangée de silhouettes (grises tant
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
| 6 *(V3)* | L'eau revient | ruisseau à l'étape 2 + 30 signes | le ruisseau dans la vue de la vallée ; brume du matin | § 11.3 |
| 7 *(V3)* | La vallée vivante | les 6 lieux à l'étape 2 + 45 signes | forêt de la carte plus claire, clairières | § 11.3 |
| 8 *(V4)* | Les cigognes | une cigogne installée | cigognes sur le clocher, puis sur le Manoir | § 11.4 |

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
| Puits « pour la beauté » | ≈ 27 000 | + 58 000 | + 175 000 chantiers + 194 000 terres | — |
| Argent en caisse à l'an 14 | ≤ 85 % de sans | ≤ 70 % | ≤ 50 % | ≤ 50 % |
| Tout restauré | — | — | an 16 à 20 (appliqué : an 11 à 14) | idem |

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
  lieu de 24). Les paliers des étapes 1 à 5 **ne changent pas** (2 / 6 / 11 / 17 / 24) : l'étape 5 « La vallée chante »
  vient environ **un an plus tôt** (vers l'an 9 au lieu de l'an 11 pour le joueur tranquille) — c'est voulu : le V2
  remplit les années où le V1 attendait ses dernières haies. Les étapes 6 et 7 du V3 (30 et 45 signes) s'appuient sur ce
  total (§ 11.3, inchangé).
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
| Étape 5 « La vallée chante » (tranquille) | « environ un an plus tôt » (vers l'an 9) | **an 6** (V1 : an 11) — *plus tôt que prévu* : les 23 variétés du V2 se sauvent au rythme de celles du pays (signes de vie : décision de l'utilisateur, paliers inchangés) ; effet sur le revenu négligeable |
| Carrière Classique, tranquille (30 × 10 ans) | faillites ≤ 20 % | **0 %** ; revenu − 0,2 % ; nouveautés 92 % ; 12 trocs an 9, 9 croisements à l'an 10 |
| Traîne (60 × 18 ans) | — | tranquille : revenu sur 18 ans **+ 2,7 %** ; argent en caisse à l'an 18 : 88 % de sans la Vallée (le V3 prendra le relais) ; dépenses du V2 63 295 |
| Niveaux | identiques | `node tools/simulate.js` **identique octet pour octet** ; parité 400 / 400 |

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
