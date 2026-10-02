# Synthèse : rendre le jeu plus accessible, plus amusant, moins répétitif

Date : 2026-10-02. Synthèse de quatre études menées en parallèle :

1. `1-analyse-du-jeu.md` — notre jeu joué sur téléphone émulé (niveau 1, carrière débutante, carrière avancée).
2. `2-jeux-cosy.md` — Stardew Valley, Story of Seasons, Animal Crossing, Fields of Mistria, Farm Together, Cozy Grove, Wylde Flowers, Sun Haven, Coral Island, Littlewood, Ooblets + littérature « cosy » (Project Horseshoe, Unpacking, « Juice it or lose it »).
3. `3-jeux-mobiles.md` — Hay Day, Township, FarmVille 3, Family Island, jeux de fusion, jeux incrémentaux (Egg Inc.), Mini Metro, Islanders, Dorfromantik, Pocket Camp…
4. `4-accessibilite.md` — audit selon les Game Accessibility Guidelines, Xbox AG, WCAG 2.2, W3C COGA, FALC, simulation du daltonisme.

---

## 1. Diagnostic en une page

**Ce qui marche (à garder)** : le pixel art et les saisons ; l'ergonomie téléphone et les glissés ; le ton doux (Joseph, rien n'est jamais perdu) ; la pluie de pièces ; la ferme qui grandit avec machines et salariés visibles ; des sessions courtes ; le temps qui ne passe que quand on joue.

**Les 7 problèmes majeurs**

| # | Problème | Preuve |
|---|---|---|
| 1 | **La routine ne change jamais** : récolter, « Semer partout », choisir la culture au meilleur « +X/jour », arroser. Une culture domine, la récolte ne réserve aucune surprise. | 3 touches + 2 glissés par jour, identiques sur toute l'année, les 12 niveaux et la carrière |
| 2 | **La carrière se joue toute seule** : une fois mécanisée, la ferme gagne, remporte le comice et débloque des succès sans le joueur. Le geste qui fait le plaisir disparaît quand on est le plus investi. | 3 années sautées sans rien toucher : +5 500 et +6 300 pièces par an |
| 3 | **Détente sans enjeu** : les choix ne comptent plus. | Niveau 1 gagné en ne faisant rien après le poulailler ; 887 pièces pour un fermage de 90 |
| 4 | **Pas d'apprentissage en carrière**, pourtant le gros bouton du menu ; le tutoriel du niveau 1 est long (206 mots) et oublie des gestes clés. | 4 bulles, 60 mots, « comme d'habitude » |
| 5 | **Trop d'informations d'un coup** : 21 déblocages en une fenêtre, boutique de 12 écrans, 1 020 mots, 53 boutons. | Captures [40] [51] |
| 6 | **Le temps file pendant qu'on lit**, les messages disparaissent, l'objectif suivant n'est pas visible à l'écran. | 2 jours passés dans la boutique ; offres perdues en 6 s |
| 7 | **Accessibilité incomplète** : informations portées par la couleur seule (prévision du fermage, sol arrosé), contraste des boutons insuffisant (2,99:1 au lieu de 4,5:1), pas de réglage de taille du texte, pas de vitesse lente, mouvements du canevas non réduits, pause en haut à droite hors de portée du pouce. | Mesures et simulations de daltonisme |

**La leçon commune aux jeux étudiés** : les jeux à succès du genre luttent contre la répétition avec **des demandes variées** (tableau de commandes de Hay Day, paniers de Stardew), **des surprises dans l'action la plus fréquente** (qualité d'or, récoltes géantes, fée nocturne), **des collections** (musée, herbier), **des objectifs longs qui transforment le monde** (le Centre communautaire de Stardew) et **une sensation de toucher irrésistible** (« l'action la plus fréquente doit être la plus agréable »). Ils évitent l'énergie, les délais stressants, la peur de rater quelque chose et l'empilement de systèmes.

---

## 2. Catalogue retenu (meilleures idées des quatre études, adaptées à notre jeu)

Effort : S (petit), M (moyen), L (gros).

### A. Confort et accessibilité (rapide, fort impact)
- **A1. Pause pendant la lecture** : le jeu se met en pause dès qu'une fiche est ouverte (option, activée par défaut en Détente). — S
- **A2. Vitesse douce ×½** et option « pause chaque matin ». — S
- **A3. Prévision du fermage lisible sans couleur** : icône + mot (✓ couvert / ! juste / ✗ danger), aussi lu par les lecteurs d'écran. — S
- **A4. Contrastes** : boutons plus foncés, bandeau opaque, bouton Pause bleu ardoise (le rouge réservé au danger), vraies coches dans les options. — S
- **A5. Taille du texte** 100–150 %, zoom autorisé, police alternative très lisible (Atkinson Hyperlegible, OFL). — M
- **A6. Mouvements réduits partout** : plus d'éclair plein écran ni de tremblements quand l'option est cochée. — S
- **A7. Sol assoiffé visible** : petite goutte au-dessus des parcelles à arroser, pousse visible dès la semence. — S
- **A8. Commandes du temps en bas**, à portée de pouce (option main gauche). — S
- **A9. Historique des messages** et offres qui restent dans le Carnet tant qu'elles sont valables. — S
- **A10. Textes FALC** (faciles à lire) pour le tutoriel et les fiches, glossaire « Fermage = loyer de la ferme ». — M
- **A11. Section Accessibilité** proposée au premier lancement. — S

### B. Toucher et surprises (rendre l'action principale irrésistible)
- **B1. Récolte « juteuse »** : la plante s'écrase et rebondit, les pièces volent jusqu'au compteur, **note qui monte** à chaque parcelle d'un même glissé (gamme pentatonique), total affiché en fin de glissé. — S
- **B2. Récoltes de qualité** : petites chances de récolte **belle** (×1,5) ou **dorée** (×2) avec étincelle, augmentées par l'arrosage régulier, les ruches, la rotation. — S/M
- **B3. Légumes géants** : un carré 2×2 de la même culture mûre peut fusionner en citrouille géante (×6), souvenir mémorable. — M
- **B4. Surprises de l'aube, toujours positives et rares** : une fée fait mûrir un carré 3×3, un renard s'installe, un coffre ancien, un arc-en-ciel. — S/M
- **B5. Météos spéciales rares** : pluie chaude (pousse ×2), brouillard aux champignons, étoile filante (vœu). — S/M
- **B6. Trouvailles au défrichage** des nouveaux terrains : souches cachant des coffres, vieux puits, animal perdu. — M

### C. Variété (moins de répétition)
- **C1. Tableau de commandes du village** (cœur de la variété chez Hay Day) : 3 commandes courtes toujours visibles, renouvelées à l'aube, refusables sans pénalité, une relance gratuite, uniquement avec ce que la ferme peut produire cette saison, payées ×1,2–1,5. — M
- **C2. Choix d'un bonus en fin de saison** (Mini Metro, Islanders) : deux cartes gratuites (engrais, poule offerte, graines à moitié prix…), une à garder. Transforme le bilan en décision et rend les niveaux rejouables. — S/M
- **C3. Charrette du marché** : une grosse commande en caisses par saison, payée en partie même incomplète, bonus si tout est rempli. Pousse à diversifier. — M
- **C4. Défis de saison choisis** : 3 proposés, on en garde 1 ou 2, médailles bronze/argent/or, sans série à entretenir. — M
- **C5. Années à thème en carrière** : « année des abeilles », « année du fromage », « boom touristique »… une culture vedette, une fête spéciale, un visiteur unique ; toujours au moins à moitié positif. — S/M
- **C6. Fêtes participatives** : mini-jeux sans chrono ni échec (chasse aux œufs, soupe partagée, stand jugé sur la qualité et la variété) ; la foire aux graines placée avant les semis. — M/L
- **C7. Marchand ambulant à date fixe** (graines rares, objets uniques) : on attend « le jour du marchand ». — M
- **C8. Hiver vivant** : serre accessible plus tôt, pêche, cuisine, préparation du printemps. — M

### D. Motivation à long terme
- **D1. Album de la ferme / herbier** (musée d'Animal Crossing, Stardew) : une case par culture, variante dorée, produit, animal, météo rare, visiteur, fête ; une anecdote chacune ; une récompense par page complète ; commun aux deux modes. — M
- **D2. Restauration du village par paniers** (Centre communautaire de Stardew) : des paniers thématiques à remplir réparent visiblement la boulangerie, la gare, l'école…, chacun donne un vrai avantage. Donne un but long à la carrière quand l'argent n'a plus d'usage. — L
- **D3. Bilan de fin d'année « lanternes »** (le grand-père de Stardew) : 1 à 4 lanternes sur 5 critères visibles (variété, soin des bêtes, voisinage, beauté, prospérité), on peut toujours mieux faire l'année suivante. Redonne un enjeu doux à la Détente. — M
- **D4. Cuisine maison** : recettes de 2–3 ingrédients à découvrir, petits bonus d'un jour, cadeaux aux voisins, entrées d'album. — M
- **D5. Quelques voisins** avec amitié (en plus de Joseph). — L

### E. Apprentissage et clarté
- **E1. Première minute dans le champ** : la carrière commence avec des parcelles mûres ; premier glissé de récolte en 5 secondes ; chaque geste appris en le faisant (planter, arroser, glisser, « Semer partout »), texte minimal. — M
- **E2. Ligne « À faire maintenant »** toujours visible sur l'écran de jeu (prochain objectif + raccourci). — S
- **E3. Déblocages progressifs** : onglets et sections qui apparaissent quand ils deviennent utiles ; au passage de rang, 3 nouveautés mises en avant au lieu de 21 ; boutique filtrée (« Ce qui est nouveau », « Ce que je peux acheter »). — M
- **E4. Chaînes de production lisibles** : recettes en pictogrammes ; un ingrédient manquant indique sa source, et un toucher y emmène. — M
- **E5. Guide de la ferme relisible** + petit résumé du matin (« Hier : +46. Aujourd'hui : 3 parcelles à récolter, commande de Mme Rose »). — S
- **E6. Écran « Où en étais-je ? »** au retour dans une partie. — S

### F. Garder le joueur au centre en carrière
- **F1. Machines et salariés qui aident sans remplacer** : prime de récolte à la main bien visible (et plus forte : qualité dorée réservée aux récoltes manuelles), salariés qui s'occupent des corvées (arrosage) plutôt que des moments gratifiants. — M
- **F2. Bouton « Tout ramasser »** et glissé étendu aux abris et ateliers. — S/M

---

## 3. Feuille de route proposée

| Lot | Contenu | Pourquoi d'abord | Taille |
|---|---|---|---|
| **1. Confort & accessibilité** | A1 → A11 (sauf A10 partiel), E2, E5, E6, F2, corrections des bugs relevés | Règle des frustrations immédiates (temps qui file, lisibilité, pouce) | ~2 jours de travail d'agents |
| **2. Toucher & surprises** | B1, B2, B4, B5, B3 | Rend l'action la plus fréquente amusante ; peu de systèmes nouveaux | moyen |
| **3. Variété** | C1, C2, C3, C4, C5, C7 (un même générateur de demandes « faisables cette saison ») | Casse la routine dans les deux modes | moyen–gros |
| **4. Collection & enjeux doux** | D1, D3, F1, C6, C8 | Objectifs moyens/longs, Détente avec un sens | moyen–gros |
| **5. Grand projet village** | D2, D4, D5, E1/E3 complets, B6 | But long de la carrière | gros |

**À éviter absolument** (retours des études) : énergie ou endurance, délais stressants, séries de connexion à ne pas casser, notifications qui culpabilisent, multiplication des monnaies et des fermes, fabrication un objet à la fois, prestige qui fait tout perdre, classements en ligne.


## Décisions de l'utilisateur (2026-10-02)

- Lots 1, 2, 3 et 4 à développer dans l'ordre ; en carrière, salariés et machines « aident sans remplacer ».
- Pas de copie de la restauration du village de Stardew : le grand projet de carrière sera **« La Vallée vivante »** (la Vallée qui revient + la Grainothèque vivante, voir `5-idees-projet-long.md`), développé **après les 4 lots**.

---

## 4. État du lot 1 « Confort & accessibilité » (2026-10-02)

Audit du code après le lot 1 (détails : `JOURNAL.md`, entrées « Lot 1 » du 2026-10-02 ; API : `docs/ARCHITECTURE.md`, sections « Lot 1 — confort »).

| Point | Lot 1 | Où dans le code |
|---|---|---|
| A1 Pause pendant la lecture | ✓ Fait (réglage auto / oui / non, auto = Détente) | `src/ui/sheets.js`, `src/ui/a11y.js` |
| A2 Vitesse ×½ et pause chaque matin | ✓ Fait | `src/data/balance.js`, `src/core/options.js`, `src/ui/a11y.js`, `src/ui/hud.js` |
| A3 Fermage lisible sans couleur | ✓ Fait (✓ / ! / ✗ + mot + libellé lu) | `src/ui/hud.js`, `css/style.css`, police Ferme |
| A4 Contrastes | ✓ Fait (boutons 5–7,6:1, Pause bleu, vraies coches, mode contrastes renforcés) | `assets/sprites/ui/*-deep.png`, `css/style.css` |
| A5 Taille du texte, zoom, police lisible | ✓ Fait (100–150 %, Atkinson Hyperlegible) | `src/ui/a11y.js`, `src/ui/dialogs.js`, `css/style.css` |
| A6 Mouvements réduits partout | ✓ Fait (canevas compris) | `src/render/scene.js`, `src/render/effects.js` |
| A7 Sol assoiffé visible, pousse dès la semence | ✓ Fait (goutte, coche, pousse, terre humide) | `src/render/scene.js` |
| A8 Commandes du temps en bas, main gauche | ✓ Fait (option) | `src/ui/tabbar.js`, `src/ui/hud.js` |
| A9 Historique des messages, offres gardées | ✓ Fait | `src/ui/messages.js`, `src/ui/toasts.js`, `src/ui/career/journal.js` |
| A10 Textes FALC, glossaire | ◐ Partiel (glossaire « mots de la ferme », guide en phrases ≤ 25 mots ; tutoriel et fiches à réécrire) | `src/ui/guide.js` |
| A11 Section Accessibilité au premier lancement | ✓ Fait | `src/ui/dialogs.js` |
| E2 Ligne « À faire maintenant » | ✓ Fait | `src/ui/todo.js`, `css/guidance.css` |
| E5 Guide de la ferme + résumé du matin | ✓ Fait | `src/ui/guide.js`, `src/ui/todo.js` |
| E6 « Où en étais-je ? » | ✓ Fait | `src/ui/todo.js` |
| F2 Tout ramasser (bouton et glissé) | ✓ Fait | `src/core/game.js`, `src/ui/todo.js`, `src/ui/gestures.js` |
| Bugs de l'analyse (annexe B 1 à 7, frictions 6 à 12, 15, 17, 19) | ✓ Corrigés | voir le tableau des bugs de `JOURNAL.md` |
| Annexe B n° 8 (glissé qui fait défiler la carte) | ? Non reproduit, à vérifier au doigt | `src/ui/gestures.js` |
| Frictions 14 (icônes des graines sans libellé), 21 (succès empilés) | ✗ Hors lot 1 | lots suivants |
