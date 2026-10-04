# Cahier des charges — version téléphone (prioritaire)

Décision de l'utilisateur (2026-09-29) : **le jeu est d'abord un jeu de téléphone**, tenu en **portrait**, testé sur **Android + Chrome**, **installable** (application web / PWA, plein écran, hors ligne). Le PC reste supporté, mais toute décision se prend d'abord pour le téléphone.

Problèmes signalés sur la V1 : **tout est trop petit**, **l'affichage est coupé/décalé**, **les touches ne marchent pas** (toucher une parcelle ou un bouton ne fait rien ou fait la mauvaise action).

## Appareil de référence

- Écran de référence : **412 × 915 CSS px, DPR 2,625** (Pixel 7, Chrome Android). Doit aussi marcher de **360 × 740** (petit Android) à **430 × 932**, et en fenêtre PC.
- Barre d'adresse Chrome qui apparaît/disparaît : utiliser `100dvh` / `visualViewport`, jamais `100vh` seul.
- Encoches et barre de gestes : `viewport-fit=cover` + `env(safe-area-inset-*)`.

## Règles d'ergonomie tactile (non négociables)

- **Cible tactile ≥ 48 × 48 CSS px** pour tout ce qui se touche (boutons, onglets, lignes de liste, **parcelles**).
- **Texte ≥ 14 CSS px** (corps), 12 px minimum pour les mentions secondaires ; chiffres importants (argent) ≥ 18 px.
- Zones d'action principales **dans le tiers bas de l'écran** (pouce).
- Aucune information accessible **seulement au survol** : tout ce qui était en infobulle se trouve en touchant (fiche en bas d'écran) ou en appui long.
- Pas de zoom involontaire (double-tap, pincement sur l'interface) : `touch-action` adapté, `user-scalable=no` dans le viewport de l'application installée, `overscroll-behavior: none`, pas de sélection de texte ni de menu contextuel sur appui long dans le jeu.
- Réponse immédiate au toucher (pas de délai de 300 ms, retour visuel `:active`, petite vibration optionnelle `navigator.vibrate(10)` réglable dans les options).
- Un geste = une intention : un toucher bref = action ; glisser sur le champ = arroser/récolter en série ; glisser ailleurs = faire défiler la scène si elle dépasse l'écran.
- **Zoom de la ferme** : pincer à deux doigts sur la scène = zoomer / dézoomer autour du point entre les doigts (le geste d'un doigt en cours est annulé, jamais d'action) ; double toucher dans le vide = zoom par défaut ; boutons « + » / « − » (48 px) à portée de pouce, collés au bord de l'écran : au-dessus de la mini-carte en carrière (ou de son bouton « Carte » repliée), au-dessus de la ligne « À faire » en Niveaux (bord gauche pour gaucher en Niveaux ; en carrière la mini-carte reste à droite, la colonne aussi) ; les messages se rangent à côté d'eux. Zoom posé toujours entier (pixel art net), de « toute la ferme visible » à ×2,5 environ ; zoomée, la ferme défile dans les deux sens, bornée au monde. Sans animation en mouvement réduit. Retenu par mode (Niveaux / Carrière). À distinguer de la taille du texte (100–150 %) et de la loupe de l'interface (zoom de la page, option d'accessibilité).

## Disposition en portrait

```
┌───────────────────────────┐  ← safe-area haut
│ HUD compact (2 lignes)    │  argent · date/saison · météo · fermage · pause/vitesse
├───────────────────────────┤
│                           │
│   SCÈNE (canvas)          │  monde en portrait, champ au centre,
│   parcelles de 2×2 tuiles │  défilement vertical si le monde dépasse
│                           │
├───────────────────────────┤
│ Barre d'onglets en bas    │  Ferme · Acheter · Bilan · Menu   (≥ 56 px)
└───────────────────────────┘  ← safe-area bas
```

- **Scène** : un monde **en portrait** (≈ 16 tuiles de large), zoom entier en pixels physiques qui remplit la largeur. Les **parcelles font 2 × 2 tuiles** (32 px monde) pour dépasser 48 CSS px à l'écran de référence ; les cultures sont dessinées à l'échelle ×2 (toujours pixel art net). Champ au centre, bâtiments/enclos au-dessus et au-dessous, maison et route en bas. Si le monde est plus haut que la zone visible, il défile verticalement au doigt (inertie légère), et la vue se recentre sur le champ au démarrage.
- **Panneaux** (Acheter, Bilan, Menu, choix des graines, fiche d'une parcelle ou d'un bâtiment) : **feuilles qui montent du bas** (bottom sheets), hauteur max ≈ 70 % de l'écran, poignée, fermeture par glissement vers le bas, bouton ✕, ou toucher sur la scène. La scène reste visible au-dessus.
- **La parcelle touchée reste visible** au-dessus de la feuille ouverte : la scène défile en douceur (au besoin au-delà du bas du monde), puis revient à sa place à la fermeture.
- **Messages** (toasts) : au-dessus des onglets et des feuilles, sans capter les touchers (seul le bouton « Voir » d'un message qui propose une action se touche) ; **deux au plus à la fois**, les autres dans l'historique (pastille « +N messages »). *(2026-10-03)* Compacts (une ligne pour une info, deux au plus pour un message important, ≈ 40 px) ; réglage « Messages à l'écran » : **importants seulement par défaut** (refus, alertes, choix à faire), les autres nouvelles vont à l'historique (cloche) et au résumé du matin, regroupées. **Bandeau** (titre du niveau, saison) : sous la barre du haut, jamais par-dessus elle ni par-dessus une bulle du tutoriel.
- **Choix des graines** : feuille du bas avec de grandes lignes (icône, nom, durée, prix, gain), une seule touche pour semer ; option « semer partout ».
- **Fenêtres importantes** (fin de saison, victoire, faillite, niveaux, options, crédits) : plein écran ou feuille haute, défilement interne si besoin, boutons en bas.
- **Tutoriel** : bulles placées en haut ou en bas selon la cible, jamais par-dessus la cible, texte court.
- **Paysage sur téléphone** : afficher une invitation à tourner le téléphone (sauf sur PC/tablette, où la mise en page paysage actuelle reste disponible).

## Application installable (PWA)

- `manifest.webmanifest` : nom « Une année à la ferme », nom court « La Ferme », `display: standalone` (ou `fullscreen`), `orientation: portrait`, couleurs de thème, icônes 192/512 + maskable, captures d'écran.
- **Service worker** : met en cache tout le jeu (HTML, CSS, JS, images, sons, police) pour jouer **hors ligne** ; cache versionné, mise à jour propre (message « Nouvelle version disponible — Recharger »). Fichiers publiés à empreinte (`node tools/build.js`) : jamais de mélange de versions, même avec le cache HTTP de GitHub Pages (docs/ARCHITECTURE.md, « Construction et publication »).
- **Chargement robuste sur réseau mobile** : un seul fichier JS et un seul CSS, jauge qui avance dès le premier octet, nouveaux essais automatiques, erreur réelle affichée (« Détails »), démarrage sans attendre la musique.
- Bouton « Installer le jeu » (événement `beforeinstallprompt`) dans le menu, quand c'est possible.
- **Jamais bloqué sur une version cassée** : garde-fou de démarrage dans `index.html` (nouvelle version activée et un seul rechargement si le jeu ne démarre pas ; sinon bouton « Réparer le jeu ») et bouton « Réparer le jeu (vider le cache) » dans les options (progression conservée).
- Garder l'écran allumé pendant la partie si possible (Wake Lock, réglable).
- Audio débloqué au premier toucher ; mise en pause propre quand l'appli passe en arrière-plan.

## Vérification

- Playwright en émulation **Pixel 7** (`isMobile`, `hasTouch`, DPR 2,625, portrait) et **360 × 740** : utiliser `page.tap()` / événements tactiles réels, jamais la souris.
- Mesurer la taille à l'écran de chaque cible tactile (≥ 48 px) et de chaque texte (≥ 12/14 px) par script.
- Jouer une année complète au doigt sur le niveau 1 (tutoriel compris) et un niveau difficile, sans erreur console.
- Lighthouse / critères d'installabilité PWA vérifiés (manifest valide, service worker actif, hors ligne OK).
