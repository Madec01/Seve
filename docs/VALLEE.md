# La Vallée vivante — conception (2026-10-03)

Le **grand projet long du mode Carrière** : la Vallée qui revient (faune, paysage) et la Grainothèque vivante (variétés
anciennes), réunies en un seul fil, raconté par Joseph. Choix de l'utilisateur (2026-10-02, confirmé le 2026-10-03) ;
idéation : `docs/analyse/5-idees-projet-long.md` § 4. Contrats de code du lot V1 : `docs/ARCHITECTURE.md`, « Vallée
vivante — contrats du lot V1 ». Résumé : `docs/GAME_DESIGN.md` § 18.

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
