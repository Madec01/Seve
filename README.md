# SÈVE — *Le Chant des Racines*

Un jeu d’arcade de culture, de soin des écosystèmes et de **résonance musicale**.
Sans dépendance, sans compilation, jouable sur PC et sur téléphone en paysage.

> Le monde tenait debout parce qu’il chantait. Puis le Réseau s’est tu, et là où
> le chant s’éteint monte la Cendre. Tu es la dernière Semeuse-Luthière : tu ne
> possèdes pas d’outil tranchant, tu possèdes cinq notes.

---

## Jouer

**En ligne / avec un serveur local** — le jeu est en modules ES, il lui faut donc
le protocole `http://` :

```bash
cd seve
python3 -m http.server 8000     # ou : npx http-server -p 8000
```

puis ouvre <http://localhost:8000/>. Une publication sur GitHub Pages fonctionne
telle quelle.

**Sans serveur** — ouvre `hors-ligne.html` par double-clic. C’est le jeu entier
en un seul fichier, généré par `node tools/bundle.mjs`.

---

## Commandes

| | PC | Téléphone (paysage) |
|---|---|---|
| Se déplacer | `ZQSD` · `WASD` · flèches | joystick, moitié gauche de l’écran |
| **Agir** — semer, arroser, récolter, purifier | `Espace` · clic gauche | bouton **Agir** |
| **Accorder** — onde de résonance | `E` · clic droit | bouton **Accorder** |
| **Souffle** — esquive, disperse la Cendre | `Maj droit` · `C` | bouton **Souffle** |
| Changer de graine | `1`…`5` · `Tab` | toucher une graine |
| Pause | `Échap` · `P` | bouton ‖ |
| Mode Test | `T` | bouton du menu |

Bascule plein écran : le bouton ⛶ en haut à droite.

---

## Comment on joue

### La résonance
Chaque graine porte un **degré** d’une gamme pentatonique : `I` `II` `III` `V` `VI`.
Des plantes **mûres et voisines** forment un groupe, et le jeu y reconnaît un
**accord** :

| Accord | Degrés | Multiplicateur | Effet |
|---|---|---|---|
| Quinte ouverte | I + V | ×1,6 | onde de purification |
| Tierce | I + III | ×1,5 | — |
| Suspendu | I + II + V | ×2,2 | ralentit la Cendre |
| Majeur | I + III + V | ×2,6 | large onde de purification |
| Mineur | VI + I + III | ×2,8 | fait mûrir les voisines |
| **Pentatonique** | les cinq | ×5,0 | purifie tout l’écran |

Récolter **une** plante d’un accord récolte **tout l’accord** d’un coup, joue
littéralement les notes et libère une onde. Le champ n’est pas une grille de
rendement : c’est une partition.

### La justesse
Chaque biome a un **Pouls**. Un anneau se contracte autour de toi à chaque
pulsation ; agir à ±130 ms du temps donne un **Juste**, qui alimente une chaîne
`×1 → ×1,5 → ×2 → ×3 → ×4`. La chaîne multiplie la sève **et** accélère la
croissance de tout le champ. Trois pulsations sans Juste, et elle retombe.

### La Cendre
Elle naît des fissures et se propage au rythme du Pouls. Elle tue les plantes,
interdit les semis et assourdit le son. Si elle recouvre 65 % du champ, le Cycle
s’achève en Étiolement. On la repousse par les accords, le degré `III`, la
purification manuelle et le Souffle.

Un **Cycle** dure trois saisons, cinq à huit minutes. La sève rapportée alimente
**le Verger** : améliorations permanentes, nouvelles graines, nouveaux biomes.

---

## Contenu

5 biomes · 5 espèces · 6 accords · 7 évènements aléatoires · 24 succès ·
12 échos de lore · 5 personnages · défi du jour déterministe ·
3 emplacements de sauvegarde · tutoriel interactif · Mode Test.

---

## Sous le capot

Tout est fabriqué à l’exécution : **aucune image, aucun fichier audio**.

- **Son** — synthèse WebAudio : cordes pincées par Karplus-Strong (le timbre
  d’une kora en bois), clics de bois filtrés, gouttes d’eau, souffle, flûte à
  vibrato. La musique est générative et calée sur le Pouls du biome ; elle
  s’assombrit quand la Cendre monte et s’éclaircit quand tu enchaînes.
- **Voix** — les personnages parlent en charabia organique : chaque caractère
  révélé déclenche une syllabe dont la hauteur dépend de la lettre, filtrée par
  des formants de voyelle. Le même texte sonne donc toujours pareil.
- **Image** — Canvas 2D vectoriel, formes organiques et palettes par biome.
- **Interface** — DOM pour les menus et le HUD, canvas pour ce qui vit dans le
  monde. Aucun texte n’apparaît d’un bloc : machine à écrire, texte flottant,
  pulsations.

### Arborescence

```
seve/
├── index.html            page unique
├── hors-ligne.html       version en un seul fichier (générée)
├── css/style.css
├── src/
│   ├── main.js           amorçage et boucle
│   ├── core/             rng · events · storage · input · loop
│   ├── audio/            audio · synth · music · voice
│   ├── game/             constants · scales · biomes · plants · field
│   │                     resonance · player · run · npcs · progression
│   │                     achievements · challenges · randomevents · lore · tutorial
│   ├── ui/               dom · text · render · actors · portraits
│   │                     hud · screens · hub · dialogue
│   └── debug/testmode.js
├── tools/
│   ├── bundle.mjs        génère hors-ligne.html
│   ├── verifier.mjs      58 vérifications sans navigateur
│   └── parcours.mjs      parcours automatisé dans Chromium (Playwright)
└── DESIGN.md             document de conception
```

---

## Mode Test

`T` en jeu, ou depuis le menu principal. Panneau latéral permettant de :

- faire apparaître n’importe quelle espèce, à n’importe quel stade ;
- **poser un accord complet en un clic**, pour tester sa reconnaissance et son effet ;
- peindre ou effacer la Cendre, ouvrir une fissure ;
- régler le tempo en direct, forcer une fin de saison, gagner ou perdre le Cycle ;
- déclencher n’importe quel évènement aléatoire ou dialogue ;
- activer l’invincibilité, afficher la grille de débogage et les diagnostics
  (image par seconde, pulsation, chaîne, taux de Cendre, case visée).

---

## Développement

```bash
node tools/verifier.mjs     # règles, simulation, progression, sauvegardes
node tools/bundle.mjs       # régénère hors-ligne.html
node tools/parcours.mjs     # parcours navigateur (Playwright facultatif)
```

`hors-ligne.html` est un artefact : modifie toujours `src/`, puis régénère-le.
