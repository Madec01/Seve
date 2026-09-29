# Game design — « Une année à la ferme »

Document de référence du gameplay. Les chiffres marqués *(équilibré)* ont été réglés avec la simulation (`tools/simulate.js`) ; la version qui fait foi vit dans `src/data/`, et ce document est mis à jour en conséquence.

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
- L'argent peut devenir **négatif** à cause des charges quotidiennes, de l'arrosage automatique payant ou du prêt (petite dette tolérée, affichée en rouge), mais **si, au moment du fermage, l'argent est insuffisant, c'est la faillite** : écran de fin, bilan, recommencer. Les achats (graines, parcelles, investissements) exigent d'avoir la somme.
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

- **Barre du haut** : argent, date (jour X — saison — icône), météo du jour + prévision, vitesse (pause/×1/×2/×4), bouton menu.
- **Panneau de droite (onglets)** : *Investissements* (cartes avec prix, revenu, entretien, quantité possédée) et *Bilan* (revenu net estimé, prochain fermage, historique simple).
- **Scène centrale** (canvas pixel art, zoom entier) : champ, bâtiments, animaux animés, décor saisonnier.
- **Fenêtres** : menu principal, sélection du niveau (avec étoiles), options (volumes musique / sons / ambiance, plein écran), écran de fin de saison (résumé), victoire, faillite, pause.
- **Textes flottants** : « +12 » au-dessus des récoltes et des bâtiments à l'aube.
- **Tutoriel** (niveau 1) : bulles guidées — planter, arroser, attendre, récolter, acheter un poulailler, comprendre le fermage, préparer l'hiver.
- Raccourcis : Espace = pause, 1/2/3 = vitesses, Échap = menu.

## 10. Audio

- Musique par saison (Sirental) avec fondu enchaîné au changement de saison, thème du village au menu, festival à la victoire.
- Ambiances : oiseaux (printemps/été), vent (hiver), pluie selon la météo.
- Sons : clic, plantation, arrosage, récolte (pièces), achat, coq à l'aube, cris d'animaux ponctuels, jingle de fin de saison, victoire, faillite.
- Volumes réglables et mémorisés ; l'audio démarre après la première interaction (contrainte des navigateurs).

## 11. Sauvegarde

- Sauvegarde automatique (localStorage) à chaque aube et à la fermeture : partie en cours + progression (étoiles par niveau) + options.
- « Continuer » au menu si une partie est en cours.
