# Game design — « Une année à la ferme »

Document de référence du gameplay. Les chiffres marqués *(à équilibrer)* sont des valeurs de départ, ajustées par la simulation (`tools/simulate.js`) ; la version finale des chiffres vit dans `src/data/`, et ce document est mis à jour en conséquence.

## 1. Intention

- Jeu de gestion **relaxant** : pas de réflexes, pas de combat, pas de punition brutale.
- Une partie = **une année** (4 saisons), environ **10 à 12 minutes** en vitesse normale.
- Le plaisir vient de l'**arbitrage** : dépenser pour replanter (gain rapide) ou investir dans du **revenu quotidien automatique** (gain lent mais régulier), en préparant l'**hiver** où presque rien ne pousse.
- Contrôle **100 % souris** (raccourcis clavier en bonus).

## 2. Le temps

- 1 jour = **20 secondes** en vitesse ×1. Vitesses : pause, ×1, ×2, ×4.
- 1 saison = **7 jours** (modifiable par niveau), 1 année = 4 saisons : printemps → été → automne → hiver.
- Chaque jour commence à l'**aube** : c'est là que tombent les revenus automatiques, les charges quotidiennes et la nouvelle météo.
- La lumière de la scène suit le jour (aube rosée, midi clair, soir orangé), sans nuit noire.

## 3. Le potager

### 3.1 Parcelles
- Le champ est une grille de parcelles. Niveau 1 : **12 parcelles ouvertes** (4 × 3) sur une grille de **24** (6 × 4) ; les autres s'achètent (*prix croissant : 40, 50, 60…*).
- Clic sur une parcelle :
  - vide → choix d'une graine (liste des cultures plantables cette saison, avec prix, durée, gain) ;
  - plantée, pas encore arrosée aujourd'hui → **arrosage** ;
  - mûre → **récolte** : l'argent est gagné immédiatement (+ petite animation de pièces).
- Survol : infobulle (culture, jours restants, arrosée ou non).

### 3.2 Pousse et arrosage
- Chaque culture a une **durée de pousse** en jours et **5 étapes visuelles** (graine, pousse, jeune plant, plant, mûr).
- Chaque aube, une parcelle plantée progresse de **1 jour si elle a été arrosée la veille**, sinon de **0,5 jour**.
- La **pluie** arrose tout le champ automatiquement. La **canicule** (été) : une parcelle non arrosée ne pousse pas du tout ce jour-là.
- L'arrosage est aussi automatisable (investissement *Arrosage automatique*).
- Une culture mûre reste récoltable indéfiniment, sauf en cas de gel (ci-dessous).

### 3.3 Saisons des cultures
- Chaque culture a ses saisons de plantation. Une culture déjà plantée continue de pousser au changement de saison, **sauf à l'arrivée de l'hiver** : les cultures non « hiver » **gèlent** au 1er jour d'hiver (parcelle vidée, message clair).
- Un **avertissement** s'affiche 2 jours avant chaque changement de saison (et 2 jours avant le gel).

### 3.4 Cultures (graphismes Kenney Tiny Farm) *(à équilibrer)*

| Culture | Saisons | Durée | Graine | Vente |
|---|---|---|---|---|
| Carotte | printemps, automne | 2 j | 4 | 10 |
| Navet | printemps, automne, hiver | 3 j | 6 | 16 |
| Blé | printemps, été | 4 j | 5 | 15 |
| Chou | automne, hiver | 4 j | 8 | 24 |
| Tomate | été | 5 j | 12 | 38 |
| Maïs | été, automne | 6 j | 15 | 50 |
| Tournesol | été | 5 j | 10 | 32 |

(La liste exacte dépend des sprites disponibles dans le pack ; toute culture ajoutée suit le même format.)

## 4. Les investissements (revenu automatique quotidien)

Chaque investissement s'achète une fois ou plusieurs (quantité max), apparaît physiquement dans la scène (bâtiment, animaux qui se promènent) et rapporte **chaque aube**. Certains ont un **entretien quotidien** ou un effet spécial. *(à équilibrer)*

| Investissement | Prix | Revenu | Entretien/jour | Max | Particularité |
|---|---|---|---|---|---|
| Poulailler (poules) | 120 | +7/jour | 2 | 3 | Revenu régulier toute l'année |
| Ruche | 100 | +5/jour (0 en hiver) | 0 | 3 | Chaque ruche : cultures +10 % de vitesse de pousse (hors hiver) |
| Étal au bord de la route | 180 | +4/jour (+8 en été) | 0 | 1 | Récoltes vendues **+20 %** |
| Vache | 280 | +16/jour | 5 | 3 | Nécessite l'étable (achetée avec la 1ʳᵉ vache) |
| Moutons | 220 | 0/jour | 3 | 3 | **Tonte** : +110 à la fin de chaque saison sauf l'hiver |
| Arrosage automatique | 150 / 250 / 400 | — | 1 | 3 niveaux | Arrose 8 / 16 / toutes les parcelles chaque matin |
| Panneau solaire | 160 | −4 de charges/jour | 0 | 2 | Réduit les charges fixes |
| Chambre d'hôte | 550 | +25 été, +14 printemps/automne, +4 hiver | 2 | 1 | Gros revenu saisonnier |

Revente : impossible (on assume ses choix — cohérent avec l'arbitrage).

## 5. Les charges et la faillite

- **Charges quotidiennes** : entretien de la ferme (*4/jour*) + entretien des investissements − panneaux solaires (minimum 0).
- **Fermage de fin de saison** : payé automatiquement le dernier soir de chaque saison. Niveau 1 : *120 / 200 / 280 / 360* (printemps → hiver).
- L'argent peut devenir **négatif** à cause des charges quotidiennes (petite dette tolérée, affichée en rouge), mais **si, au moment du fermage, l'argent est insuffisant, c'est la faillite** : écran de fin, bilan, recommencer.
- Un **indicateur de prévision** montre en permanence : prochain fermage, jours restants, revenu quotidien net estimé.

## 6. Victoire et étoiles

- Survivre au **fermage d'hiver** = année réussie → écran de victoire (musique de festival), bilan de l'année.
- Étoiles selon l'argent final *(à équilibrer, par niveau)* : ★ année terminée, ★★ ≥ seuil 2, ★★★ ≥ seuil 3.
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
| 6 | Le marché fou | Le prix de vente de chaque culture varie chaque jour (×0,5 à ×1,8), affiché | Volatilité des prix |
| 7 | Le crédit | Départ avec 600 pièces, mais une mensualité de 40 pièces tous les 7 jours en plus du fermage | Prêt |
| 8 | L'année bio | Pas d'arrosage automatique ; replanter la même culture sur une parcelle réduit son rendement de 30 % (rotation) | Fatigue du sol |

Chaque niveau définit aussi : argent de départ, parcelles ouvertes, fermages, seuils d'étoiles, investissements disponibles.

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
