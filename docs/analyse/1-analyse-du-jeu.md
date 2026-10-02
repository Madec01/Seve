# Analyse critique — « Une année à la ferme » vue par un joueur sur téléphone

*Date : 2026-10-02 · Version analysée : `main` au commit `f43b08e` (Carrière v2) · Aucun fichier du projet n'a été modifié.*

## 0. Méthode

- Jeu servi en local (`python3 -m http.server 8765`), piloté par Playwright (Chromium, **Pixel 7 émulé** : 412 × 915, DPR 2,625, `hasTouch`, gestes **tactiles uniquement** : `touchscreen.tap` et vrais `touchStart/Move/End` CDP pour les glissés), adresse `index.html?nosw&debug=1`.
- Parcours joués :
  1. **Nouveau joueur, mode Niveaux** : écran de chargement → menu → « Les niveaux » → niveau 1 avec le tutoriel, au doigt, du semis au poulailler, puis l'année complète (deux fois : une fois en « joueur distrait » qui ne replante plus après l'été — par accident de script, ce qui s'est révélé instructif —, une fois en joueur appliqué : récolte au glisser, « Semer partout », arrosage au glisser, achats).
  2. **Nouvelle carrière** (Détente, saisons de 7 jours) : création, 4 bulles d'accueil, année 1 entière jouée au doigt (récolte/semis/arrosage chaque jour, ramassage des œufs), bilan, achat du premier terrain, passage au rang 2, aménagement d'un champ.
  3. **Carrière en milieu de partie** : rang forcé à 4 et 40 000 pièces (aides de débogage), achat de 3 terrains, étable, porcherie, atelier, fromagerie, 2 vaches, 2 cochons, ruches, arroseurs, semoir, moissonneuse, 2 employés ; événements forcés (visiteur, corbeaux) ; puis **3 années passées sans toucher** (`careerSkipYears(3)`).
- Mesures : comptage des gestes par le script, texte des feuilles (`innerText`), hauteurs de défilement, tailles de texte et de cibles, mots des bulles du tutoriel (comptés sur les textes de `src/ui/tutorial.js`), lecture des docs (`GAME_DESIGN.md`, `CARRIERE.md`, `MOBILE.md`, `JOURNAL.md`) et du code d'interface.
- Captures : `scratchpad/screens/analyse-*.png` (référencées ci‑dessous par leur numéro, ex. **[05]** = `analyse-05-graines.png`).

> Limite : les durées « réelles » mesurées par le script sont gonflées par les temps d'attente du pilotage ; les durées de jeu sont donc exprimées en **jours de jeu** (1 jour = 20 s à ×1, 10 s à ×2, 5 s à ×4).

---

## 1. Synthèse en une page

**Ce qui marche très bien** : la direction artistique (pixel art Kenney + sprites maison cohérents), la lisibilité au téléphone (texte ≥ 14 px partout sauf les libellés d'onglets à 13 px, aucune cible < 44 px mesurée), les feuilles du bas, le glisser pour arroser/récolter, la pluie de pièces et les « +13 » flottants, le ton bienveillant (Joseph, « pas grave ! »), la sécurité du mode Détente, les machines et employés **visibles** dans la scène.

**Les trois problèmes de fond** :

1. **La boucle minute par minute est un rituel identique chaque jour** : *glisser pour récolter → toucher une parcelle → activer « Semer partout » → choisir la culture → glisser pour arroser*. Une fois ce rituel trouvé (≈ jour 3), il ne change plus jusqu'à la fin de l'année ni d'une année à l'autre ; il n'y a **aucune surprise au champ** (pas de récolte exceptionnelle, pas de légume géant, pas de combo, pas de variation de son ou de rendement visible). En Carrière, la réponse prévue à cette corvée est… de **la supprimer** (machines, employés) : la ferme finit par jouer seule (**+5 500 à +6 300 pièces par an sans aucun geste**, comice gagné et 4 succès débloqués en dormant — **[56]**).
2. **Le défi a été retiré au point que les décisions ne comptent plus**. Niveau 1 Détente : un joueur qui achète un poulailler puis **ne fait plus rien pendant trois saisons gagne quand même l'année** (Joseph avance l'argent puis l'efface — **[17] [18]**). Un joueur appliqué termine l'automne avec **887 pièces pour un fermage de 90**. En Carrière, l'année 1 rapporte **+1 127** sans aucun achat **[39]**. Sans tension, les arbitrages (cœur du design : « dépenser pour replanter ou investir ») n'ont plus d'enjeu, donc plus de saveur.
3. **La complexité arrive d'un coup, au mauvais endroit**. Le premier écran met en avant « **Ma ferme** » (bouton rouge, en premier **[01]**), qui **n'a pas de tutoriel** (« Semez, arrosez, récoltez *comme d'habitude* » **[32]**). Le passage au rang 2 déverse **21 nouveautés** dans une seule fenêtre **[40]**. La boutique de milieu de carrière fait **12,6 écrans de haut, 1 020 mots, 53 boutons** **[51]**. À l'inverse, le niveau 1 explique 10 bulles (206 mots) pour une mécanique que le joueur a comprise au bout de deux.

**Les 5 chantiers les plus rentables** (détaillés au § 7) : (a) un vrai « premier quart d'heure » de Carrière ; (b) de la surprise et de la variété dans le geste de récolte ; (c) des objectifs courts et visibles en permanence (« prochaine chose à faire ») ; (d) un défi réglable qui redonne du sens aux choix sans punir ; (e) un étalement des déblocages et une boutique filtrée.

---

## 2. Boucle de jeu et sensations, minute par minute

### 2.1 Le rythme mesuré

| Moment | Ce que fait le joueur | Gestes |
|---|---|---|
| Écran de chargement → menu | « Prêt ! » puis **un toucher sur « Commencer »** obligatoire avant le menu **[00]** | 1 |
| Menu → niveau 1 | « Les niveaux » → carte « Première année » **[02]** | 2 |
| Tutoriel jusqu'au premier semis | « C'est parti ! » → parcelle → « Carotte » **[04] [05]** | 3 |
| Premier arrosage, vitesse | parcelle → bouton vitesse **[06] [07]** | 2 |
| Semer les 11 autres parcelles | parcelle → « Semer partout » → culture **[08]** | 3 |
| Arroser 12 parcelles | **1 glissé** en serpentin (11/12 arrosées du premier coup) **[09]** | 1 glissé |
| Récolter 12 parcelles | **1 glissé** → +156 pièces d'un coup **[10]** | 1 glissé |
| Premier achat (poulailler) | onglet Acheter → « Acheter 70 » → fermer | 3 |

- **Planter 12 parcelles** : **24 touchers** parcelle par parcelle (2 par parcelle : parcelle + culture), ou **3 touchers** avec « Semer partout ». L'option se **réinitialise à chaque fermeture** de la feuille (`plantEverywhere = false`, `src/ui/field.js:171`) : il faut la recocher à chaque fois.
- **Journée type d'un joueur appliqué** (niveau ou carrière an 1) : **≈ 3 touchers + 2 glissés par jour**, soit ≈ 5 gestes toutes les 10 s à ×2. Mesuré sur l'année 1 de carrière : **43 touchers et 23 glissés en 27 jours** (récolte, semis, arrosage, œufs).
- **Temps jusqu'au premier achat** : jour 8 (été, jour 1) en suivant le tutoriel, qui demande d'attendre « fermage + 70 » pièces. En pratique l'argent est là dès le jour 5 (260 pièces après la première récolte **[10]**).
- Une année de niveau dure 28 jours ≈ **9 min 20 à ×1**, ≈ 5 min à ×2, ≈ 2 min 20 à ×4.

### 2.2 Attente et temps morts

- **Les carottes mûrissent en 2 jours** : il y a quelque chose à faire tous les 1 à 2 jours au printemps. Avec le maïs (6 j) ou la tomate (5 j) en été, **les jours intermédiaires se réduisent à un glissé d'arrosage** — et en Détente l'arrosage n'apporte que +33 % (0,75 → 1 jour de pousse), donc même ce geste devient facultatif. Le joueur passe alors à ×4 et regarde.
- **L'hiver est un grand vide** : en niveau, seuls navet et chou ; en carrière an 1, le champ est vide pendant 7 jours **[36]**, rien à acheter d'utile, aucun événement prévu (le Marché de Noël est verrouillé au rang 1).
- **Le temps continue pendant les feuilles** : en ouvrant la boutique, le joueur perd 2 jours de jeu à lire (été 1 → été 3 sur **[13] → [14]**) pendant que son champ récolté reste vide. C'est une **friction de rythme** autant qu'un manque à gagner : on apprend vite à mettre en pause avant d'ouvrir un menu (geste de plus).

### 2.3 Retour sensoriel (« juiciness »)

| Élément | État | Commentaire |
|---|---|---|
| Récolte | Pièces qui jaillissent + « +13 » flottants **[10]**, son « harvest » + « coin » | Le meilleur moment du jeu. Mais **toujours identique** : même son (variation de hauteur ±5 % seulement), même montant, pas de « crescendo » quand on récolte 12 parcelles d'un trait, pas de total affiché à la fin du glissé. |
| Arrosage | Le fermier marche jusqu'à la parcelle, gouttes, sol assombri **[07] [09]** | Le sol arrosé n'est que **légèrement plus foncé** : on distingue mal ce qui reste à arroser. Le sprite du fermier **masque la parcelle** qu'il arrose **[07]**. |
| Pousse | 5 étapes visuelles | Rien ne signale qu'une parcelle est **mûre** à part le sprite (pas d'étincelle, pas de petit rebond) **[09]**. |
| Achat | Toast « Poulailler acheté ! », bâtiment qui apparaît | Le bâtiment apparaît **hors champ** (en haut, sous la feuille) **[14]** : on rate la récompense visuelle. |
| Aube | Coq, « +7 » au-dessus des bâtiments | Discret ; correct. |
| Fin de saison | Fenêtre bilan + jingle **[12]** | Claire mais purement comptable : aucune mise en scène. |
| Victoire | Étoiles animées, festival, écus, succès **[18]** | Bonne fanfare, mais la fenêtre est **une longue liste** de chiffres ; le bouton « Niveau suivant » est tout en bas. |
| Passage de rang | Fanfare, confettis, liste de 21 icônes **[40]** | Récompense forte… noyée sous la liste. |
| Carrière : œufs | Bulle « 🥚 8 » au-dessus du poulailler **[41]** | Très bon signal ; le ramassage est satisfaisant. |
| Carrière : machines | Tracteur, semoir, arroseurs animés **[53]** | Beau, donne un vrai sentiment de ferme qui grandit. |
| Vibration | Présente (8–25 ms selon le geste) | Bien. |

**Manques notables** : pas de particules de « récolte parfaite », pas de culture rare/dorée, pas de combo, pas de son qui monte en gamme pendant un glissé, pas de petite animation de joie du fermier, pas de compteur « total de la journée ». Pour un jeu dont le geste central est la récolte, c'est là que le plaisir se gagne ou se perd.

---

## 3. Répétitivité

### 3.1 Ce que le joueur refait sans cesse

1. **Le rituel quotidien** (§ 2.1), identique pendant 28 jours × 12 niveaux × N années de carrière. Dès qu'il est maîtrisé, il n'y a plus de décision dedans : la meilleure culture de la saison est toujours la même (la feuille l'affiche : « +5,3 par jour » pour la fraise **[33]**), on choisit la ligne la plus verte, partout.
2. **La même culture sur toutes les parcelles** : « Semer partout » + « Gain par jour » affiché = monoculture optimale évidente. Rien n'encourage la diversité (pas de bonus de variété, de rotation hors niveau 8, de commande mixte, de concours de « plus beau potager »).
3. **La même structure d'année** : printemps facile → été rentable → automne pour les réserves → hiver vide. Les 12 niveaux changent un paramètre (météo, prix, durée, prêt…) mais **la boucle reste celle du niveau 1** ; il n'y a pas d'objectif propre à chaque niveau hormis l'argent final (et le concours du niveau 12).
4. **Les fenêtres de fin de saison** : 4 par année, même contenu, même bouton « Continuer » **[12]**.
5. **En carrière**, chaque année recommence le même calendrier fixe (Foire aux semis → Fête du village → Fête des récoltes → Marché de Noël) ; les fêtes sont des **multiplicateurs passifs** (« graines −25 % », « ventes +25 % ») qui ne demandent rien de spécial au joueur — et qu'on rate facilement : la Foire aux semis tombe au **jour 3** alors que le joueur a déjà tout semé (et dépensé 73 % de son argent, sans confirmation, avec « Semer partout ») au jour 1 **[35]**.

### 3.2 Quand cela devient une corvée

- **Niveaux** : dès le 2ᵉ niveau. Le tutoriel a tout montré, et le niveau 2 (sécheresse) ajoute surtout une pénalité (arroser coûte 1 pièce) sans nouveau geste agréable.
- **Carrière** : vers le milieu de l'année 1, quand le champ de départ est maîtrisé et qu'il n'y a encore rien à acheter d'intéressant (rang 1 : pas de terrain avant d'y penser, aucun conseil sur le terrain avant le **1er jour de l'année 2** alors que le joueur avait 1 000+ pièces dès l'automne **[38]**).
- À partir de 2 champs (28 parcelles), les champs ne tiennent plus dans un écran : le glisser doit être refait par terrain, avec défilement ; c'est précisément là que le jeu pousse vers les machines.

### 3.3 Systèmes qui manquent de variété ou de surprise

| Système | Constat |
|---|---|
| Météo | 6 types, effet surtout mécanique (la pluie arrose). Aucune météo « cadeau » ou « événement » dans les niveaux. |
| Événements de carrière | **≈ 1 sollicitation par semaine de jeu** (simulation, `CARRIERE.md` § 13.5) : 1 toutes les ~70 s à ×2. Ils arrivent en **toast de quelques secondes** qui disparaît (vu : l'offre du visiteur n'était plus affichée 6 s plus tard ; puis « Une proposition a expiré : pas grave ! » **[51] [55]**). |
| Corbeaux | La parcelle visée peut être **hors écran** ; la caméra ne s'y déplace pas **[55]**. Seul « mini-jeu » d'adresse du jeu, et il est rare (poids 10/83 × 15 %). |
| Quêtes de Joseph | Au plus une toutes les deux saisons, du type « apporte N <culture> » ; sur 3 années passées sans toucher, **0 quête** (il faut accepter). Peu de narration : Joseph ne raconte rien de lui. |
| Comice | Gagné **sans rien faire** en milieu de carrière (+1 600 l'an 4, succès « Champion du comice ») **[56]** : il ne crée ni objectif ni tension. |
| Employés | Traits tous positifs, humeur à 3 états, aucune histoire ; ce sont des multiplicateurs. |
| Animaux | Produits à ramasser ; aucune interaction (caresser, nommer, nourrir une fois de temps en temps). |
| Contenu « bientôt » | Mare et serre affichées comme aménagements « bientôt » **[43]** : promesse non tenue visible. |

### 3.4 Fin de partie

- **Niveaux** : 12 niveaux × 3 étoiles, bonus permanents en étoiles, décor en écus. Une fois les étoiles prises, il ne reste rien (pas de défi quotidien, pas de variante aléatoire, pas de record par niveau mis en avant).
- **Carrière** : Domaine visé à l'an 9 pour un joueur tranquille (~1 h 30 à 2 h de jeu effectif), puis « jeu libre » : records, succès, embellissements (en partie « phase B »). Mais la ferme est alors **automatisée** : la simulation vise ~2,5 gestes « robot » par jour à l'an 5, 5 % des récoltes et semis faits à la main dès l'an 4 (`CARRIERE.md` § 13.4). **Le geste qui fait le plaisir disparaît précisément quand le joueur est le plus investi.** Le bonus « récolté à la main +10 % » est trop faible et invisible pour donner envie de toucher.

---

## 4. Accessibilité et prise en main

### 4.1 Premières minutes

- **Deux écrans avant le menu** : chargement « Prêt ! » + toucher « Commencer » **[00]**, puis menu.
- **Le menu oriente mal le débutant** : « Ma ferme » est le gros bouton rouge en premier ; « Les niveaux » (qui contient le tutoriel) est en second **[01]**. Un nouveau joueur qui choisit « Ma ferme » reçoit 4 bulles (60 mots) dont la dernière dit « comme d'habitude » **[32]** : **aucun apprentissage de semer/arroser/récolter ni du glisser**. C'est la plus grosse faille d'accessibilité du jeu.
- **Écran « Choisir une année »** : difficulté, bonus permanents, grange, puis carte du niveau avec « Départ 160 · 12/24 parcelles · Fermages 20 · 60 · 90 · 130 · 2★ dès 300 · 3★ dès 490 » **[02]** : 7 nombres et 3 notions (fermage, étoiles, bonus) avant d'avoir joué.
- **Tutoriel du niveau 1** : 10 bulles, **206 mots** au total (de 12 à 33 mots par bulle) ; 4 bulles mettent en pause et exigent un bouton. Il est bien placé (bulle en haut ou en bas, anneau jaune sur la cible **[04] [06]**), mais :
  - la bulle « Le fermage » **interrompt la première récolte** (elle surgit au milieu de la pluie de pièces **[10]**) ;
  - la consigne « Investir » demande d'attendre « fermage + 70 » alors que le joueur a déjà 260 pièces : elle apparaît puis devient un bandeau minimisé qu'on oublie **[11]** ;
  - le glisser pour arroser n'est mentionné qu'**entre parenthèses** dans une bulle de 25 mots ; le glisser pour **récolter** n'est jamais enseigné ; « Semer partout » non plus ;
  - le tutoriel se relance à chaque « Rejouer » du niveau 1.
- **Le champ au départ** : parcelles ouvertes (mottes de terre orangées), parcelles à acheter (pointillés + pièce) et parcelles verrouillées (pointillés seuls) se distinguent, mais les pointillés gris sur herbe sont peu contrastés **[03]**.

### 4.2 Quantité de texte et de nombres

- Feuille des graines **[05]** : par culture 4 nombres (durée, prix de la graine, prix de vente, gain/jour) avec des **icônes sans libellé** (le sac = prix de la graine, la pièce = prix de vente : il faut deviner) + une note « Gain par jour = bénéfice ÷ jours de pousse ».
- Boutique du niveau 1 **[13]** : 6 cartes, 2,2 écrans, un paragraphe d'intro, revenus par saison en 4 petites icônes de saison.
- Fin de saison **[12]** : 6 lignes comptables.
- **Carrière milieu de partie** : boutique dépliée = **7 275 px de haut (12,6 écrans), 1 020 mots, 53 boutons** **[51]** ; Carnet en 5 onglets (Ferme, Bilan, Marché, Agenda, Joseph) **[53]** ; Équipe ; fiche de chaque terrain avec plan de culture 4 lignes + machines + équipe **[44]**. La fiche finances aligne 7 lignes de charges dont **« Entretien (animaux, bâtiments) » en double** et **« Panneaux solaires +−5 »** (bug d'affichage).
- **Jargon** : fermage, charges de saison, patrimoine (avec sa formule affichée **[37]**), cours (×0,94), hors saison ×1,25, mise en réserve, places d'atelier, vendre en l'état, plan de culture « Même culture », chômage technique, carburant… Chaque mot est expliqué quelque part, mais **leur nombre** fait la charge cognitive.

### 4.3 Découvrabilité

- **Appui long = fiche** : annoncé une fois, jamais rappelé.
- **Le glisser** (le geste le plus utile) n'est pas mis en avant (voir ci-dessus).
- **Le premier terrain** : objectif « Acheter un premier terrain » affiché dans le Carnet **sans bouton pour y aller** **[37]** ; le conseil de Joseph n'arrive qu'à l'année 2.
- **Fiche du terrain vide** après l'achat lorsque la fenêtre de rang s'interpose : la feuille « Le Haut-Champ » s'ouvre avec **seulement son titre** **[42]** (bug) ; il faut fermer puis retoucher le panneau pour voir « Choisir l'aménagement » **[43]**.
- **Événements en toast** : l'offre d'un visiteur (« Touchez pour répondre ») disparaît en quelques secondes et se superpose à d'autres toasts **[34 j18]** ; si on la rate, on n'apprend qu'elle a existé que par « Une proposition a expiré ».
- **Pastilles** jaunes sur Acheter/Équipe/Carnet presque en permanence en carrière **[50]** : elles perdent leur valeur d'alerte.
- La **mini-carte** occupe le coin bas-droit de la scène (et masque des parcelles) **[35] [56]**.

### 4.4 Lisibilité, couleur, une main

- **Tailles** : mesurées sur la boutique de carrière, seuls les libellés d'onglets (13 px) et deux pastilles sont sous 14 px ; **aucune cible tactile sous 44 px**. Très bon travail (conforme à `MOBILE.md`).
- **Police** Jersey Ferme : lisible, mais les **paragraphes longs en pixel font** se lisent lentement (cartes de la boutique, bilans).
- **Couleur** : le fermage passe vert/orange/rouge — le texte (« dans 6 j », « demain ») ne change pas de sens, seule la couleur porte l'alerte **[03] [36]** ; les cours du marché ont heureusement des flèches ▲▼ en plus de la couleur **[53 Marché]**. Le sol arrosé/non arrosé ne se distingue que par une nuance de brun.
- **Une main** : onglets en bas (bien), mais **vitesse/pause en haut à droite** (zone la plus difficile au pouce droit, impossible au pouce gauche), et les bulles de conseil s'affichent **en haut** avec leur bouton « Compris » au milieu de l'écran **[38] [50] [55]**. Les feuilles hautes poussent les boutons d'action loin (bilan de victoire : bouton « Niveau suivant » sous 1,5 écran **[17]**).
- **Animations réduites** : option présente (et `prefers-reduced-motion` respecté), vibration réglable, plein écran, écran allumé. Pas d'option de **taille du texte**, de **contraste renforcé**, ni de **mode daltonien**.
- **Son** : sons distincts pour chaque action et alerte (avertissement, gel) : bon repère audio. Mais pas de signal sonore spécifique pour « une offre vous attend » ou « parcelles mûres ».

### 4.5 Difficulté et échecs

- **Détente (défaut)** : quasi impossible de perdre au niveau 1 (voir § 1). Le succès « Sur le fil » récompense même l'inaction.
- **Classique** : choisir le mode au premier écran de niveaux est intimidant (le débutant ne sait pas encore ce qu'est un fermage).
- **Pics** : selon la simulation, le niveau 2 en Classique ruine 70–100 % des joueurs insouciants ; le passage du niveau 1 Détente (aucun enjeu) aux niveaux suivants est une marche, pas une pente.
- **Échec en carrière** : « coup dur », chômage technique, vente de secours — bien pensé et doux, mais rarement vécu (le joueur n'y arrive presque jamais).

---

## 5. Progression et motivation

| Horizon | Niveaux | Carrière |
|---|---|---|
| **Court (minute)** | Récolter, voir l'argent monter | Idem + ramasser les œufs + (rarement) un événement |
| **Moyen (saison)** | Payer le fermage (sans enjeu en Détente) | Charges de saison (20 au départ : anecdotiques), fête du calendrier |
| **Long (année)** | Étoiles (2★ 300, 3★ 490) | Rang suivant (patrimoine + 2 objectifs) **[37]** |
| **Très long** | 12 niveaux, bonus, décor | Domaine (an 6–10), 16 terrains, records |

Constats :

- **Le « prochain objectif » n'est jamais à l'écran de jeu.** Il vit dans le Carnet (carrière) ou dans le Bilan (niveaux). La barre de rang du HUD (écusson + petite jauge) **[36]** est un bon début mais ne dit pas *quoi faire*.
- **Cadence des récompenses irrégulière** : rien pendant l'année 1 de carrière (aucun achat intéressant au rang 1 sauf poules/ruches), puis **21 déblocages en une fenêtre** au rang 2 **[40]**, puis à nouveau de longues plages.
- **Récompenses passives** : comice gagné, succès et rangs qui tombent pendant que les machines travaillent **[56]** : la récompense ne récompense plus un effort.
- **Sentiment de propriété** : fort en Carrière (nom de la ferme, tenue, Fermier/Fermière, ferme qui s'étend, machines visibles, chat adopté **[50]**). Faible en Niveaux (chaque année repart de zéro ; seul le décor suit). Petit accroc : les sprites « Fermier » et « Fermière » sont **identiques** à la création **[30]** ; et le portrait de Joseph est **le sprite du joueur** dans le tutoriel des niveaux **[03]** mais un vieux monsieur barbu en carrière **[31]**.
- **Écus/étoiles/pièces** : trois monnaies (plus les « ♥ » de Joseph) pour un jeu « cosy » ; la distinction étoiles (niveaux) / écus (décor) / pièces (partie) est logique pour un développeur, floue pour un joueur.

---

## 6. Frictions classées (de la plus grave à la plus légère)

| # | Friction | Gravité | Réf. |
|---|---|---|---|
| 1 | **Pas de tutoriel en Carrière**, alors que « Ma ferme » est le bouton principal du menu | Bloquant pour un débutant | [01] [31] [32] |
| 2 | **Rituel quotidien sans décision ni surprise** (glisser–semer partout–glisser), identique toute l'année et toutes les années | Cœur de la répétitivité | [08] [09] [10] |
| 3 | **Aucun enjeu en Détente** : on gagne le niveau 1 en ne jouant pas ; fermages minuscules face aux gains | Tue l'arbitrage | [17] [18] [12] |
| 4 | **La ferme de carrière joue seule** une fois mécanisée (+5–6 k/an sans geste, comice et succès passifs) | Fin de partie vide | [56] |
| 5 | **Mur de déblocages** (21 au rang 2) et **boutique de 12,6 écrans / 1 020 mots** | Surcharge | [40] [51] |
| 6 | **Le temps court pendant les feuilles** (boutique, carnet, fiches) : champ vide, offres qui expirent | Frustration | [13] [14] [51] |
| 7 | **Offres en toasts éphémères**, superposés ; on les rate | Frustration | [34 j18] [54] [55] |
| 8 | **Bulles de conseil qui couvrent le haut de la feuille** que le joueur vient d'ouvrir (Acheter, carte) et qui arrivent à contretemps (« L'embauche » après avoir embauché ; « La forêt à vendre » un an trop tard) | Gêne | [38] [50] [51] |
| 9 | **« Semer partout » non mémorisé** et **sans confirmation de coût** (144 pièces sur 200 d'un toucher) | Gestes en trop / piège | [33] [35] |
| 10 | **Feuille de terrain vide** après l'achat quand la fenêtre de rang s'intercale | Bug | [42] |
| 11 | **Corbeaux et événements hors écran** (pas de recentrage de la caméra) | Gêne | [55] |
| 12 | **Vitesse/pause en haut à droite**, hors de portée du pouce | Ergonomie | [03] |
| 13 | **Écran « Choisir une année » chargé de nombres** et choix de difficulté avant d'avoir joué | Charge cognitive | [02] |
| 14 | **Icônes sans libellé** dans la feuille des graines (sac/pièce) | Compréhension | [05] |
| 15 | **Sol arrosé peu distinct**, culture mûre sans signal, fermier qui masque la parcelle | Lisibilité | [07] [09] |
| 16 | **Le nouveau bâtiment apparaît hors champ**, sous la feuille | Récompense ratée | [14] |
| 17 | Alerte du fermage portée **par la couleur seule** | Accessibilité | [36] |
| 18 | Contenu **« bientôt »** (mare, serre) affiché | Attente déçue | [43] |
| 19 | Textes : « 5 pommes de terre, **payés** », « 1 parcelle : touchez-**les** », « Atelier de confitures niv. 2 **(niv. 2)** » (données du rang), « Panneaux solaires **+−5** », ligne d'entretien en double | Finition | [54] [55] [53 Bilan] |
| 20 | Toucher « Commencer » obligatoire après le chargement ; tutoriel relancé à chaque « Rejouer » ; Fermier = Fermière à l'écran | Petits accrocs | [00] [30] |
| 21 | Quatre toasts de succès empilés couvrent la moitié de la scène | Gêne | [56] |

---

## 7. Pistes (pour rendre le jeu plus accessible, plus amusant, moins répétitif)

*(Propositions d'analyse, à arbitrer ; aucune n'est implémentée.)*

### 7.1 Accessibilité / prise en main
1. **Premier lancement = un seul chemin** : le menu propose « Commencer » qui lance la **Carrière avec un tutoriel intégré** (semer, arroser, glisser, récolter, ramasser, acheter un terrain) ; les Niveaux deviennent « Défis » débloqués après quelques jours. Ou, a minima, le tutoriel du niveau 1 se joue au début d'une carrière si `tutorial.done` est faux.
2. **Tutoriel par l'action, moins de mots** : viser ≤ 12 mots par bulle ; enseigner le **glisser** par une main animée qui trace le geste ; enseigner « Semer partout » au 2ᵉ semis.
3. **Pause automatique (option, activée par défaut en Détente) quand une feuille d'achat/carnet est ouverte**.
4. **Une ligne « À faire maintenant »** au-dessus des onglets (ou dans le HUD) : « 3 parcelles mûres », « Visiteur : 5 pommes de terre », « Objectif : acheter un terrain → », toucher = y aller.
5. **Déblocages étalés** : au lieu de 21 d'un coup, 3–4 par rang + des « petites étapes » (rang 2a, 2b…) ou un déblocage par objectif atteint ; la boutique **filtrée** (« Nouveautés », « Abordable », « Pour ce terrain ») et la première section seule ouverte.
6. **Pouce** : pause/vitesse doublée par un bouton dans la barre d'onglets ou sous le pouce ; bulles de conseil en bas, bouton dans le tiers bas.
7. **Lisibilité des états** : contour/pictogramme sur les parcelles non arrosées et mûres (pas seulement la teinte), icône d'alerte sur le fermage (✓ / ! / ‼), libellés « graine 4 · vente 13 » dans la feuille des graines ; options « texte plus grand » et « contraste renforcé ».

### 7.2 Plaisir du geste
8. **Récolte « juicy »** : son qui monte d'un demi-ton par parcelle pendant un glissé, petit « combo ×12 ! » et total à la fin, rebond des cultures mûres, étincelle sur la parcelle mûre.
9. **Surprises au champ** : légume géant/doré rare (×3, compte pour le comice), double récolte, papillon/coccinelle à toucher, trèfle à quatre feuilles ; graines « mystère » du marchand.
10. **Rendre le geste précieux en carrière** : « cueilli main » plus visible et plus fort pour certaines choses (qualité ★ des produits, concours, commandes « fait main »), petits mini-gestes rares (pêche, chasser les corbeaux avec la caméra qui vient, caresser un animal pour un bonus d'humeur).

### 7.3 Variété et enjeux
11. **Objectifs de niveau propres** (au-delà de l'argent) : « livrer 10 tomates au marché du village avant l'été », « 3 cultures différentes en même temps », « finir sans arrosage automatique »… avec étoiles liées à ces objectifs.
12. **Commandes et contrats** plus présents et **persistants** (tableau des commandes dans le Carnet, avec durée longue), favorisant la **diversité** des cultures plutôt que la monoculture.
13. **Fêtes actives** : chaque fête du calendrier = un petit objectif ou mini-événement (stand à remplir, concours du plus beau panier, vente aux enchères) au lieu d'un multiplicateur passif ; annonce **avant** le semis (la Foire aux semis au jour 3 arrive après les semis du jour 1).
14. **Hiver à contenu** : bricolage/amélioration de bâtiments, préparation du plan de l'an prochain, marché de Noël dès le rang 1, cueillette de bois/champignons en forêt, histoire de Joseph au coin du feu.
15. **Défi réglable sans punition** : en Détente, garder « jamais de faillite » mais ajouter des **paliers d'objectifs facultatifs** (médailles de saison) qui donnent une raison de bien jouer ; en Niveaux, des fermages Détente qui suivent un peu les revenus.
16. **Narration légère** : Joseph et quelques voisins récurrents (le maire, Mlle Perrin) avec de petites histoires par saison ; les employés gagnent une anecdote par niveau.
17. **Fin de partie** : défis annuels aléatoires (« l'année de la grêle douce », « le grand marché »), prestige de la ferme (« rouvrir » une parcelle de forêt rare), collection (herbier, ménagerie) avec cartes illustrées.

---

## 8. Forces à préserver absolument

1. **La direction artistique** et la cohérence des sprites maison avec Kenney ; les saisons qui recolorent toute la ferme (automne orangé **[34 j18]**, hiver mauve **[36]**).
2. **L'ergonomie téléphone** : portrait, feuilles du bas, cibles ≥ 44–48 px, texte ≥ 14 px, glisser pour arroser/récolter, vibration, PWA robuste.
3. **La bienveillance** : Joseph qui avance l'argent, « pas grave ! », rien ne se perd, jamais de mort ou de destruction ; le mode Détente comme filet de sécurité.
4. **La pluie de pièces à la récolte** et les « +N » flottants : base parfaite pour plus de « juice ».
5. **La ferme qui grandit visiblement** en carrière : terrains, bâtiments, machines et employés qui bougent dans la scène, mini-carte ; le sentiment de propriété (nom, tenue, chat).
6. **La clarté des fiches** (« Ce que fait ce bâtiment », « EN BREF », conseils) **[44]** et les objectifs de rang en cases à cocher **[37]**.
7. **Le temps qui ne passe qu'en jeu** (aucune obligation de revenir).
8. **Des sessions courtes** (une année ≈ 5–10 min) adaptées au téléphone.

---

## Annexe A — Chiffres clés

| Mesure | Valeur |
|---|---|
| Écrans avant le premier geste de jeu (niveau 1) | chargement + menu + choix de l'année + bulle d'accueil = 4 |
| Bulles du tutoriel (niveau 1) | 10 bulles, 206 mots, 4 pauses à bouton |
| Bulles d'accueil (carrière) | 3 fenêtres + 1 conseil, 60 mots, 0 geste enseigné |
| Planter 12 parcelles | 24 touchers (une à une) ou 3 (« Semer partout ») |
| Arroser / récolter 12 parcelles | 1 glissé chacun (11/12 arrosées au premier passage) |
| Gestes par jour (joueur appliqué, an 1) | ≈ 1,6 toucher + 0,85 glissé en moyenne (43 + 23 en 27 jours, carrière) |
| Premier achat possible / conseillé | jour 5 (260 pièces) / jour 8 (consigne du tutoriel) |
| Niveau 1 Détente, joueur inactif après l'été | **gagné** (0 pièce, 1★, prêt de Joseph effacé) |
| Niveau 1 Détente, joueur appliqué, fin d'automne | 887 pièces pour 90 de fermage |
| Carrière an 1 sans achat | +1 127, 61 récoltes, rang 2 atteignable dès l'automne |
| Déblocages au rang 2 | 21 |
| Boutique Niveau 1 | 6 cartes, ≈ 2,2 écrans |
| Boutique Carrière (milieu de partie, tout déplié) | 6 sections, 7 275 px (12,6 écrans), 1 020 mots, 53 boutons |
| Carnet de carrière | 5 onglets |
| Carrière an 3–4, sans aucun geste (ferme mécanisée) | +5 529 et +6 343 par an ; comice gagné ; 4 succès |
| Sollicitations de carrière (simulation) | ≈ 1 par semaine de jeu |
| Texte < 14 px (boutique carrière) | 8 éléments (onglets 13 px) ; cibles < 44 px : 0 |

## Annexe B — Bugs et coquilles relevés en jouant

1. Feuille du terrain vide (titre seul) après achat d'un terrain suivi de la fenêtre « Nouveau rang » **[42]**.
2. Fiche finances : « Panneaux solaires **+−5** » ; « Entretien (animaux, bâtiments) » en double (−13 et −2) **[53 Bilan]**.
3. Libellés de déblocage « Atelier de confitures niv. 2 **(niv. 2)** » (résumé de rang).
4. Accords : « 5 pommes de terre, payés » ; « 1 parcelle : touchez-les » **[54] [55]**.
5. Conseils à contretemps : « L'embauche » affiché après une embauche ; « La forêt à vendre » seulement au 1er jour de l'année 2 **[38] [50]**.
6. Bandeau de titre de la carrière contenant encore « Hiver · Fermage de l'hiver : 130 pièces » (texte de la partie de niveau précédente, dans `.banner-titles`) au lancement de la carrière (vu dans le DOM au premier écran, non visible à l'écran à ce moment).
7. Portrait de Joseph différent entre Niveaux (sprite du joueur) et Carrière (vieux barbu) ; sprites Fermier/Fermière identiques à la création **[03] [30] [31]**.
8. Un glissé qui part d'une parcelle partiellement hors écran peut faire défiler la scène latéralement en carrière (carte 2D) au lieu d'arroser (observé pendant le pilotage, à confirmer au doigt réel) **[34 j18] [36]**.
