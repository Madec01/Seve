# SÈVE — *Le Chant des Racines*

**Document de conception — v1.0**
Jeu d'arcade de culture, de soin des écosystèmes et de résonance.

---

## 1. Pitch

Le monde tenait debout parce qu'il chantait. Sous chaque forêt, chaque marais,
chaque vallée, courait le **Réseau** : un maillage de racines qui transportait la
sève d'un biome à l'autre, et avec elle une note. Tant que les notes s'accordaient,
la terre respirait.

Puis le Réseau s'est tu. Là où le chant s'éteint monte **la Cendre** : une
grisaille lente, silencieuse, qui étouffe les racines et efface les couleurs.

Tu es la dernière **Semeuse-Luthière**. Tu ne possèdes pas d'outil tranchant.
Tu possèdes cinq notes, une paume, et le souffle. Tu replantes le chant.

---

## 2. Piliers de design

1. **Chaque geste sonne.** Aucune action muette. Semer, arroser, récolter, respirer :
   tout produit un son acoustique, chaud, joué par une synthèse à cordes pincées.
2. **La musique EST la mécanique.** Les plantes ne sont pas des ressources, ce sont
   des notes. Le champ est une partition. Bien jouer, c'est bien cultiver.
3. **Arcade d'abord.** Une partie dure 5 à 8 minutes, se comprend en 30 secondes,
   se maîtrise en 30 heures.
4. **Organique, jamais numérique.** Pas de bip. Du bois, de l'eau, du souffle, de la corde.
5. **Rien de statique.** Tout texte s'anime : machine à écrire, flottement, pulsation.

---

## 3. Boucle de jeu

### 3.1 Boucle courte (la seconde)
Se déplacer → viser une case → **Semer / Arroser / Récolter / Purifier** → écouter la note.

### 3.2 Boucle moyenne (le Cycle, 5–8 min)
Un **Cycle** se joue en 3 **Saisons** de difficulté croissante.
- On sème des graines, chacune porteuse d'un **degré** de la gamme pentatonique.
- Les plantes mûrissent, la **Cendre** progresse.
- Il faut atteindre l'objectif de sève de la Saison avant la fin de ses pulsations,
  sinon la Cendre gagne du terrain.
- Fin de Cycle : écran de **Floraison** (score, justesse moyenne, plus bel accord).

### 3.3 Boucle longue (le Verger)
La sève récoltée alimente **le Verger**, le hub : améliorations permanentes,
déblocage des graines, des notes, des biomes, et des souvenirs des personnages.

---

## 4. Mécanique signature : **RÉSONANCE & JUSTESSE**

C'est la mécanique qui tord le trope du jeu de ferme. Deux couches superposées.

### 4.1 Couche spatiale — la Résonance
Chaque plante porte un **degré** de la gamme pentatonique majeure :

| Degré | Nom     | Couleur      | Tempérament |
|-------|---------|--------------|-------------|
| I     | Do      | ambre        | racine, stable, nourrit ses voisines |
| II    | Ré      | vert tendre  | croissance rapide, fragile |
| III   | Mi      | turquoise    | purifie la Cendre |
| V     | Sol     | indigo       | portée : étend le rayon de résonance |
| VI    | La      | mauve        | rendement élevé, mûrit lentement |

Les plantes **mûres et connectées orthogonalement** forment des groupes. Le jeu
analyse l'ensemble des degrés présents dans chaque groupe et y reconnaît un **Accord** :

| Accord           | Degrés     | Taille min | Multiplicateur | Effet |
|------------------|------------|------------|----------------|-------|
| Quinte ouverte   | I + V      | 2          | ×1.6           | onde de purification courte |
| Tierce           | I + III    | 2          | ×1.5           | — |
| Suspendu         | I + II + V | 3          | ×2.2           | ralentit la Cendre 4 pulsations |
| Majeur           | I + III + V| 3          | ×2.6           | onde de purification large |
| Mineur           | VI + I + III | 3        | ×2.8           | fait mûrir instantanément les voisines |
| Pentatonique     | les 5      | 5          | ×5.0           | **Floraison** : purifie tout l'écran |

Récolter **une** plante d'un accord récolte **tout l'accord** d'un coup, joue
littéralement l'accord au casque, et libère une **onde** qui repousse la Cendre.
Le champ n'est donc pas une grille de rendement : c'est une partition à composer.

### 4.2 Couche temporelle — la Justesse
Chaque biome possède un **Pouls** (tempo, 84 à 132 BPM). Un anneau se contracte
autour de la joueuse à chaque pulsation.

- Agir dans la fenêtre de ±130 ms autour de la pulsation = **Juste**.
- Chaque Juste incrémente la **Chaîne** : ×1 → ×1.5 → ×2 → ×3 → ×4.
- Trois pulsations sans action juste : la Chaîne retombe.
- La Chaîne multiplie la sève **et** accélère la croissance de tout le champ.

Résultat : on ne « farme » pas, on **joue** le champ, en rythme, en cherchant les
accords. Facile à apprendre (semer sur le temps), difficile à maîtriser
(composer un Mineur en trois pulsations pendant que la Cendre monte).

### 4.3 L'antagoniste : la Cendre
La Cendre naît des **Fissures** et se propage aux cases voisines toutes les N
pulsations. Une case cendrée : ne peut pas être semée, tue lentement la plante
qui s'y trouve, et **assourdit** le son local. Si la Cendre dépasse 65 % du champ,
le Cycle s'achève en **Étiolement**.

On la repousse par : les ondes d'accord, le degré III, l'action de purification
manuelle (lente), et le Souffle (le dash) qui disperse la Cendre fraîche.

---

## 5. Biomes

| Biome | Pouls | Particularité | Débloqué par |
|-------|-------|---------------|--------------|
| **La Clairière Murmurante** | 96 BPM | Doux. Sol fertile, Cendre lente. Tutoriel. | départ |
| **Les Marais de Verre** | 84 BPM | Marées : l'eau monte et descend, submerge des cases, transpose les notes d'une tierce. | 1 500 sève |
| **La Vallée Calcinée** | 120 BPM | Sécheresse : l'humidité s'évapore. Il faut chaîner les ombres. La Cendre y est native. | 4 000 sève |
| **La Canopée Suspendue** | 108 BPM | Îlots flottants reliés par des lianes ; le vent déplace les graines. | 8 000 sève |
| **Le Cœur Sourd** | 132 BPM | La source. Silence : la musique disparaît, il faut jouer de mémoire. | 15 000 sève |

---

## 6. Personnages

Ils parlent en **barks organiques** : voyelles synthétiques modulées (style
*Animal Crossing*), timbre propre à chacun, jamais de voix enregistrée.

- **Pépin** — un germe minuscule et surexcité. Timbre aigu, staccato. Enseigne, félicite, apporte les Défis du jour. *« ÇA POUSSE ! ÇA POUSSE ! »*
- **Bourdon** — vieux bourdon rond, bonhomme, cabossé. Timbre grave et bourdonnant. Tient le comptoir du Verger, vend les améliorations.
- **Ondine** — esprit du marais, énigmatique, parle en questions. Timbre liquide, glissando. Livre la lore par fragments.
- **Vieux-Cendre** — un ancien gardien à moitié calciné. Bougon, honteux. Timbre rauque, souffle. C'est *lui* qui a fait taire le Réseau — révélation de l'acte II.
- **Le Luthier** — silhouette immense, presque jamais visible. Ne parle qu'en accords. Chaque rencontre débloque une note.

---

## 7. Narration

Racontée **par le jeu, pas par des cinématiques** :
- fragments de lore trouvés en purifiant certaines cases (les **Échos**) ;
- répliques contextuelles des PNJ qui changent selon la progression ;
- l'état visuel du hub (le Verger) qui reverdit à mesure que le Réseau guérit ;
- 3 actes : *Le Silence* → *Ce qu'il a fait* → *Réaccorder le Cœur*.

---

## 8. Rejouabilité

- **Procédural** : disposition du champ, fissures, objectifs, événements aléatoires.
- **Événements** : Pluie de graines, Vent de cendre, Nuit de lune (×2 croissance),
  Silence (audio coupé, mémoire seule), Passage du Bourdon (cadeau), Marée haute.
- **Défi du jour** : graine déterministe issue de la date ; classement local.
- **Succès** : 24 succès, du tutoriel au Pentatonique parfait.
- **3 emplacements de sauvegarde** + réglages globaux.

---

## 9. Direction artistique

- **Rendu** : Canvas 2D, art vectoriel procédural — pas de fichier image. Formes
  organiques, courbes de Bézier, palettes chaudes par biome, halos, particules
  (pollen, spores, braises, gouttes).
- **UI** : arcade, lisible, coins arrondis, matière « bois clair et papier ».
- **Texte** : jamais figé. Machine à écrire pour les dialogues, texte flottant
  pour les gains, pulsation sur le HUD au rythme du Pouls.
- **Responsive** : PC (clavier/souris) et mobile **paysage** avec joystick
  virtuel, boutons tactiles et bascule plein écran.

## 10. Direction sonore

Tout est **synthétisé à la volée** en WebAudio, aucun fichier :
- **Cordes pincées** — Karplus-Strong (bruit blanc + ligne à retard filtrée) :
  le timbre d'une harpe / kora en bois. C'est la voix des plantes.
- **Bois** — clic sec filtré passe-bande : semis, navigation UI.
- **Eau** — sinus à chute rapide de fréquence : arrosage, gouttes.
- **Souffle** — bruit filtré à enveloppe douce : dash, vent, Cendre.
- **Flûte** — sinus + souffle + vibrato léger : mélodies d'ambiance.
- **Musique** : générative, pentatonique, tempo = Pouls du biome, couches
  adaptatives (ajoute un bourdon quand la Cendre monte, s'éclaircit à la récolte).

---

## 11. Architecture technique

JavaScript moderne, modules ES natifs, **zéro dépendance, zéro build**.

```
seve/
  index.html            page unique
  css/style.css         UI, responsive, thème
  src/main.js           amorçage
  src/core/             rng · events · storage · input · loop
  src/audio/            audio · synth · music · voice
  src/game/             constants · scales · biomes · plants · field
                        resonance · player · run · npcs · progression
                        achievements · challenges · randomevents · tutorial
  src/ui/               text · render · hud · screens · dialogue · touch
  src/debug/testmode.js Mode Test
  tools/bundle.mjs      génère une version hors-ligne en un seul fichier
```

**Mode Test** (touche `T`, ou bouton du menu) : panneau superposé permettant de
faire apparaître n'importe quelle plante à n'importe quel stade, peindre la
Cendre, changer de saison, régler le tempo, déclencher un événement ou un
dialogue, tout débloquer, activer l'invincibilité et afficher les diagnostics.
