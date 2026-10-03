#!/usr/bin/env python3
"""Génère les planches du lot V3 « Le ruisseau » de La Vallée vivante (style Kenney, CC0) :

  - assets/sprites/valley3.png    (planche « valley3 ») : les lieux de la vallée dans chacun de leurs états, la ferme vue
    de loin, le moulin, le chantier, le poteau, Hélène, les 10 habitants de la vallée et leurs indices, champignons,
    poissons, Reinette grise, terres sauvages et leurs icônes, clairières, pictogrammes, vignettes, onglets, décors,
    succès ;
  - assets/sprites/valley3-bg.png (planche « valley3bg ») : le grand fond de la vue de la vallée (192 × 432) dans ses
    quatre saisons, côte à côte.

Contenu : docs/ARCHITECTURE.md, « Vallée vivante — contrats du lot V3 », tableau des sprites ; docs/VALLEE.md § 17.3
(cadrage de la vue). Les lieux sont dessinés à leur taille exacte pour être posés aux coordonnées du cadrage commun :

  y (px monde) ┌──────────────── 192 ────────────────┐
     0 –  40   │ ciel, collines bleues                │
    40 – 136   │ bois de la Combe 96×96 (0,40) │ verger 80×80 (112,56)
   156 – 236   │ étang 80×64 (8,160) + moulin 32×48 (80,168) │ prairie 80×80 (112,156)
   256 – 304   │ la ferme 48×48 (72,256)              │
   320 – 384   │ bocage du chemin creux 192×64 (0,320)│
   384 – 432   │ chemin du village, clocher           │
               └──────────────────────────────────────┘
  Ru des Saules : ruban 64×312 posé en (24,120) ; il naît dans le bois, nourrit l'étang (entrée en haut, sortie en bas,
  rien n'est dessiné entre les deux : l'eau de l'étang prend le relais), passe à gauche de la ferme et sous le chemin
  creux (le bocage laisse sa bande transparente, le ruisseau y dessine le gué, la passerelle ou le pont).

Règles propres à la vue :
  - les lieux sont dessinés EN ÉTÉ avec les trois verts d'herbe Kenney (132,198,105) / (139,216,125) / (101,165,86),
    que le code recolore selon la saison (planches de saison) ; le fond, lui, a ses quatre saisons et n'emploie jamais
    ces trois verts, mais ses rectangles de lieux (herbe neutre) prennent exactement l'herbe recolorée de la saison
    (SEASON_GRASS de src/render/assets.js) : les bords des lieux se fondent dans le fond ;
  - les grands dessins de la vue (fond, lieux, ferme, moulin) ont un contour (64, 39, 50), à un cheveu du contour
    Kenney (63, 38, 49) : la neige automatique des planches d'hiver (posée sous le contour au haut de chaque tuile)
    ne raye pas ces grands dessins opaques — le givre de la vue est posé par le code de rendu.

Même méthode que generate-valley2.py (dont il reprend les outils) : palette Kenney, contour sombre, lumière en haut à
gauche ; 1 px de contour pour les icônes, les bêtes et les objets.

Le script :
  1. dessine chaque sprite ;
  2. les range dans la planche valley3 (placement automatique, déterministe, 16 tuiles de large) et écrit les deux
     planches ;
  3. réécrit, dans src/render/atlas.js, le bloc compris entre « // <valley3:auto> » et « // </valley3:auto> »
     (le crée juste après « // </valley2:auto> » s'il n'existe pas encore) et déclare les planches dans SHEETS ;
  4. vérifie qu'aucun nom ne heurte un sprite des autres planches.

Relancer :  python3 assets/sprites/generate-valley3.py   (nécessite Pillow)
Planches de contrôle (×6) et aperçus de la vue (412 px de large) :
            python3 assets/sprites/generate-valley3.py --contact DOSSIER
"""
import sys
sys.dont_write_bytecode = True  # pas de __pycache__ dans assets/sprites

from pathlib import Path
import importlib.util
import math
import random
import re
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


v2 = _load('gen_valley2', HERE / 'generate-valley2.py')
v1 = v2.v1
g2, g3, gc = v1.g2, v1.g3, v1.gc

T = 16
SHEET_COLS = 16
SHEET = 'valley3'
SHEET_BG = 'valley3bg'
OUT = v1.OUT                 # contour Kenney (63, 38, 49)
OUTV = (64, 39, 50)          # contour des grands dessins de la vue (voir plus haut)
img, flip = g3.img, g3.flip
Grid = v1.Grid
ellipse = v1.ellipse
rows_of, frame_border, lerp = v1.rows_of, v1.frame_border, v1.lerp
TOWN = Image.open(HERE / 'tiny-town.png').convert('RGBA')

PAL = dict(v2.PAL)
PAL.update({
    '«': (146, 206, 98),     # feuillage clair
    '¤': (40, 82, 56),       # feuillage très sombre
    'µ': (178, 214, 128),    # saule, bouleau : vert pâle
    '¥': (124, 170, 92),     # saule : vert gris
    '¶': (238, 236, 226),    # écorce de bouleau
    '§': (184, 156, 116),    # vase sèche claire
    '©': (126, 100, 76),     # vase sèche, fentes
    '®': (222, 196, 124),    # herbe sèche
    '°': (178, 150, 92),     # herbe sèche, ombre
    '±': (230, 194, 98),     # roseaux dorés
    '²': (180, 138, 62),     # roseaux dorés, ombre
    '³': (112, 158, 72),     # mousse
    'Æ': (250, 196, 212),    # fleur rose pâle
    'È': (66, 104, 160),     # ombre de truite
    'É': (88, 140, 214),     # eau profonde
    'Ø': (96, 120, 70),      # ciré d'Hélène (vert olive)
    'ø': (68, 88, 52),       # ciré, ombre
})
K = dict(PAL)
GRASS = [PAL['G'], PAL['j'], PAL['J']]          # les trois verts recolorés par saison
SEASON_GRASS = {                                 # = SEASON_GRASS de src/render/assets.js
    'spring': [(128, 202, 104), (150, 222, 124), (96, 168, 86)],
    'summer': [(156, 198, 92), (178, 214, 110), (122, 164, 76)],
    'autumn': [(198, 172, 84), (220, 192, 102), (162, 132, 66)],
    'winter': [(226, 234, 242), (250, 252, 255), (184, 200, 220)],
}
SEASONS = ('spring', 'summer', 'autumn', 'winter')


def C(c):
    return PAL[c] if isinstance(c, str) else c


def art(rows, outline=2, w=None, h=None, pal=None):
    return g3.art(rows, outline=outline, pal=pal or PAL, w=w, h=h)


def icon(src, pal=None, w=16, h=16):
    rows = rows_of(src) if isinstance(src, str) else src
    assert len(rows) <= h and all(len(r) <= w for r in rows), src
    return art(rows, outline=1, w=w, h=h, pal=pal)


def obj(g, outline=1):
    """Grid → image (taille exacte), contour fin."""
    return g3.art(g.rows(), outline=outline, pal=PAL, w=g.w, h=g.h)


def recolor(im, mapping):
    im = im.copy()
    px = im.load()
    m = {C(k): C(v) for k, v in mapping.items()}
    for y in range(im.height):
        for x in range(im.width):
            p = px[x, y]
            if p[3] and p[:3] in m:
                px[x, y] = m[p[:3]] + (p[3],)
    return im


def view_outline(im):
    return recolor(im, {OUT: OUTV})


def setpx(im, pts, c, a=255):
    px = im.load()
    col = C(c)
    for (x, y) in pts:
        if 0 <= x < im.width and 0 <= y < im.height:
            px[x, y] = col + (a,)
    return im


def blend_px(im, x, y, c, a):
    """Mélange une couleur (alpha a de 0 à 1) sur un pixel opaque."""
    if 0 <= x < im.width and 0 <= y < im.height:
        p = im.getpixel((x, y))
        if p[3]:
            im.putpixel((x, y), lerp(p[:3], C(c), a) + (p[3],))


# ---------------------------------------------------------------------------
# Registre : nom → image (h_px : hauteur réelle quand elle n'est pas un multiple de 16)

ENTRIES = []
_seen = set()
REAL_H = {}


def add(name, im, h_px=None):
    assert name not in _seen, name
    _seen.add(name)
    if h_px is not None:
        REAL_H[name] = h_px
        pad = img(im.width, -(-im.height // T) * T)
        pad.alpha_composite(im)
        im = pad
    assert im.width % T == 0 and im.height % T == 0, (name, im.size)
    ENTRIES.append((name, im))
    return im


def get(name):
    for n, im in ENTRIES:
        if n == name:
            return im
    raise KeyError(name)


# ===========================================================================
# 1. Petits objets de paysage (contour 1 px), posés dans les lieux et le fond

def leaf_crown(g, clumps, ramp, ring):
    v1.oak_crown(g, clumps, ramp, ring)


def tree_round(r=5.0, ramp='«D7', trunk=3, fruit=None, blossom=None, seed=0, autumn=False):
    """Arbre rond en touffes (feuillu), tronc court. Taille : (2r + 4) × (2r + trunk + 3)."""
    W = int(2 * r + 4)
    H = int(2 * r + trunk + 3)
    g = Grid(W, H)
    cx = W / 2
    cy = r + 1.5
    tx = int(cx) - 1
    for y in range(int(cy + r * 0.5), H - 1):
        g.set(tx, y, 'B')
        g.set(tx + 1, y, 'N')
    clumps = [(cx - r * 0.42, cy + r * 0.18, r * 0.66), (cx + r * 0.42, cy + r * 0.2, r * 0.64),
              (cx, cy - r * 0.28, r * 0.72)]
    leaf_crown(g, clumps, ramp, ring=ramp[-1])
    rnd = random.Random(seed)
    cells = [(x, y) for y in range(H) for x in range(W) if g.get(x, y) in ramp[:-1]]
    if blossom:
        for (x, y) in rnd.sample(cells, max(1, len(cells) // 4)):
            g.set(x, y, blossom[rnd.randrange(len(blossom))])
    if fruit:
        for (x, y) in rnd.sample(cells, max(1, len(cells) // 9)):
            g.set(x, y, fruit)
    return obj(g)


def tree_big(r=9.0, ramp='«DD7¤', seed=0, trunk=5, moss=False):
    """Grand arbre de futaie (chêne, hêtre) : couronne large en cinq touffes, tronc épais."""
    W = int(2 * r + 4)
    H = int(2 * r + trunk + 3)
    g = Grid(W, H)
    cx = W / 2
    cy = r + 1.5
    for y in range(int(cy + r * 0.4), H - 1):
        for k, ch in enumerate('BBnN'):
            g.set(int(cx) - 2 + k, y, ch)
    g.set(int(cx) - 3, H - 2, 'n')
    g.set(int(cx) + 2, H - 2, 'N')
    if moss:
        for k in range(-3, 3):
            g.set(int(cx) + k, H - 2, '³')
        g.set(int(cx) - 2, H - 3, '³')
    rnd = random.Random(seed)
    clumps = [(cx - r * 0.5, cy + r * 0.2, r * 0.55), (cx + r * 0.5, cy + r * 0.22, r * 0.55),
              (cx - r * 0.25, cy - r * 0.35, r * 0.6), (cx + r * 0.3, cy - r * 0.3, r * 0.58),
              (cx + rnd.uniform(-1, 1), cy + r * 0.05, r * 0.5)]
    leaf_crown(g, clumps, ramp, ring=ramp[-1])
    return obj(g)


def birch(h=14, seed=0):
    """Bouleau : tronc blanc tacheté de noir, petite couronne vert pâle et légère."""
    W, H = 9, h + 2
    g = Grid(W, H)
    for y in range(4, H - 1):
        g.set(4, y, '¶')
        g.set(5, y, 's')
    for y in (6, 9, 12, 15):
        if y < H - 1:
            g.set(4 + (y % 2), y, 'A')
    clumps = [(3.2, 4.0, 2.6), (5.8, 4.4, 2.6), (4.5, 2.6, 2.6), (4.5, 6.4, 2.2)]
    leaf_crown(g, clumps, 'µ«D', ring='D')
    return obj(g)


def conifer(h=12):
    """Petit sapin rond (fond, pictogrammes)."""
    W, H = 9, h
    g = Grid(W, H)
    for y in range(H - 3, H - 1):
        g.set(4, y, 'N')
    for i in range(H - 3):
        half = 0.6 + i * 0.36
        for x in range(W):
            if abs(x + 0.5 - 4.5) <= half:
                g.set(x, i, '7' if x >= 5 else 'D')
    return obj(g)


def stump(size=1):
    g = Grid(7 + 2 * size, 5 + size)
    w = 3 + 2 * size
    for x in range(1, 1 + w):
        g.set(x, 2 + size, 'N')
        g.set(x, 1 + size, 'B')
    for x in range(1, 1 + w):
        g.set(x, 1, 'k' if 1 < x < w else 'b')
    g.set(1 + w // 2, 1, 'B')
    g.set(0, 2 + size, 'N')
    g.set(1 + w, 2 + size, 'N')
    return obj(g)


def log_pile():
    g = Grid(12, 7)
    for (x, y) in ((1, 3), (5, 3), (3, 0)):
        g.ball(x + 1.5, y + 1.5, 1.6, 1.6, 'kb', ring='A')
        g.set(x + 1, y + 1, 'B')
    return obj(g)


def bramble(seed=0):
    """Roncier : boule sombre emmêlée, quelques mûres et épines."""
    g = Grid(11, 8)
    rnd = random.Random(seed)
    g.ball(5.5, 4.5, 4.8, 3.4, '3m7', ring='A')
    for _ in range(5):
        x, y = rnd.randint(2, 8), rnd.randint(2, 6)
        if g.get(x, y) != '.':
            g.set(x, y, rnd.choice('&6N'))
    for (x, y) in ((1, 2), (9, 1), (10, 4)):
        g.set(x, y, 'N')
    return obj(g)


def sapling(stake=True, tube=False, seed=0):
    """Jeune plant tuteuré (piquet et lien blanc) ou protégé par une gaine."""
    g = Grid(6, 9)
    if tube:
        g.rect(2, 4, 3, 7, 's')
        g.set(3, 4, ']'); g.set(3, 5, ']'); g.set(3, 6, ']'); g.set(3, 7, ']')
        g.set(2, 4, 'W')
        g.ball(2.8, 2.4, 1.8, 1.6, '«D', ring='A')
    else:
        for y in range(3, 8):
            g.set(2, y, 'N')
        g.ball(2.4, 2.4, 1.9, 1.7, '«D', ring='A')
        if stake:
            for y in range(1, 8):
                g.set(4, y, 'b')
            g.set(3, 4, 'w')
    return obj(g)


def hazel(seed=0):
    """Noisetier : plusieurs brins, feuillage rond, quelques noisettes."""
    g = Grid(12, 11)
    for (x0, x1) in ((5, 3), (6, 6), (7, 9)):
        g.line(x0, 9, x1, 4, 'N')
    leaf_crown(g, [(3.5, 4.5, 2.8), (8.5, 4.5, 2.8), (6, 3, 3.0)], '«D7', ring='7')
    for (x, y) in ((4, 6), (8, 2)):
        g.set(x, y, 'b')
    return obj(g)


def apple_tree(kind='old', seed=0):
    """Pommier du verger : old (tordu, clairsemé, bois mort, gui), pruned (taillé net), bloom (en fleurs),
    tended (feuillu, pommes rouges)."""
    W, H = 16, 16
    g = Grid(W, H)
    rnd = random.Random(seed)
    if kind == 'old':
        # tronc tordu penché, branches mortes
        pts = [(7, 14), (7, 12), (6, 10), (7, 8), (8, 7)]
        for (a, b) in zip(pts, pts[1:]):
            g.line(a[0], a[1], b[0], b[1], 'B')
        for y in range(8, 15):
            if g.get(7, y) == 'B':
                g.set(8, y, 'N')
        g.line(7, 8, 3, 4, 'N')
        g.line(8, 7, 13, 3, 'N')
        g.line(4, 5, 2, 2, 'N')
        leaf_crown(g, [(5, 5, 2.4), (10.5, 4.5, 2.6)], '«D7', ring='7')
        g.set(12, 2, 'N'); g.set(13, 2, 'N'); g.set(14, 1, 'N')
        g.ball(9, 8, 1.4, 1.2, 'µ¥', ring=None)           # boule de gui
        g.set(9, 8, 'w')
    else:
        for y in range(9, 15):
            g.set(7, y, 'B'); g.set(8, y, 'N')
        if kind == 'pruned':
            g.line(7, 9, 4, 6, 'N'); g.line(8, 9, 11, 6, 'N'); g.line(7, 9, 7, 5, 'N')
            leaf_crown(g, [(5, 5.5, 2.6), (10.5, 5.5, 2.6), (7.5, 4, 3.0)], '«D7', ring='7')
        else:
            leaf_crown(g, [(4.5, 6, 3.4), (11, 6, 3.4), (7.5, 4, 4.0), (7.5, 7.5, 3.4)], '«D7', ring='7')
            cells = [(x, y) for y in range(H) for x in range(W) if g.get(x, y) in '«D']
            if kind == 'bloom':
                for (x, y) in cells:
                    r_ = rnd.random()
                    g.set(x, y, 'w' if r_ < 0.42 else 'Æ' if r_ < 0.68 else g.get(x, y))
            else:
                for (x, y) in rnd.sample(cells, len(cells) // 8):
                    g.set(x, y, 'E')
    g.set(6, 15, 'n') if kind != 'old' else None
    return obj(g)


def label_post():
    """Petite étiquette blanche sur un piquet."""
    g = Grid(5, 7)
    g.rect(0, 0, 3, 2, 'w')
    g.set(1, 1, 'S'); g.set(2, 1, 'S')
    for y in range(3, 6):
        g.set(1, y, 'N')
    return obj(g)


def small_bench(w=8):
    g = Grid(w + 2, 6)
    g.rect(1, 1, w, 1, 'B')
    g.rect(1, 3, w, 3, 'b')
    g.rect(1, 4, w, 4, 'N')
    g.set(1, 2, 'N'); g.set(w, 2, 'N')
    g.set(2, 5, 'N'); g.set(w - 1, 5, 'N')
    return obj(g)


def stake():
    g = Grid(3, 7)
    for y in range(1, 6):
        g.set(1, y, 'b' if y > 1 else 'k')
    return obj(g)


def fence_down():
    """Clôture tombée : deux piquets couchés et un debout de travers."""
    g = Grid(14, 6)
    g.line(1, 4, 6, 3, 'B')
    g.line(7, 4, 12, 5, 'b')
    g.line(9, 0, 10, 4, 'N')
    g.line(1, 2, 3, 2, 'N')
    return obj(g)


def willow(size='leafy', seed=0):
    """Saule : jeune (petit) ou feuillu (rameaux qui retombent)."""
    if size == 'young':
        W, H = 9, 12
        g = Grid(W, H)
        for y in range(5, H - 1):
            g.set(4, y, 'B')
        leaf_crown(g, [(4.5, 4.0, 3.2)], 'µ¥', ring='D')
        for x in (2, 4, 6):
            for y in range(6, 8):
                if g.get(x, y) == '.':
                    g.set(x, y, '¥')
        return obj(g)
    W, H = 18, 20
    g = Grid(W, H)
    for y in range(9, H - 1):
        g.set(8, y, 'B'); g.set(9, y, 'N')
    g.set(7, H - 2, 'B'); g.set(10, H - 2, 'N')
    leaf_crown(g, [(5, 7, 4.4), (12.5, 7, 4.4), (9, 4.6, 5.0)], 'µ¥D', ring='D')
    rnd = random.Random(seed)
    for x in range(2, 16, 2):            # rameaux tombants
        top = 8 + rnd.randint(0, 2)
        for y in range(top, min(H - 3, top + 5 + rnd.randint(0, 3))):
            if g.get(x, y) in '.':
                g.set(x, y, '¥' if y % 3 else 'µ')
    return obj(g)


def pollard_willow(seed=0):
    """Saule têtard : tronc court et épais, tête noueuse d'où partent de jeunes rameaux."""
    W, H = 14, 18
    g = Grid(W, H)
    for y in range(8, H - 1):
        for k, ch in enumerate('BBnN'):
            g.set(5 + k, y, ch)
    g.set(4, H - 2, 'n'); g.set(9, H - 2, 'N')
    g.ball(7, 8, 3.4, 2.2, 'bBN', ring='A')       # tête
    g.set(6, 11, 'H'); g.set(6, 12, 'H')          # creux (où niche la chevêche)
    leaf_crown(g, [(3.5, 4.5, 2.8), (10.5, 4.5, 2.8), (7, 3, 3.2)], 'µ¥D', ring='D')
    for x in (2, 5, 9, 12):
        g.set(x, 1, '¥')
    return obj(g)


def hedge_strip(w, h=7, kind='thick', seed=0):
    """Haie champêtre vue de face (bande horizontale) : jeune (plants espacés) ou épaisse (fleurs, baies)."""
    g = Grid(w, h + 2)
    rnd = random.Random(seed)
    if kind == 'young':
        x = 2
        while x < w - 3:
            g.ball(x + 1.5, h - 1.5, 1.8, 1.8, '«D', ring='A')
            g.set(x + 1, h, 'N')
            x += rnd.choice((4, 5))
        for x in range(w):
            if g.get(x, h + 1) == '.':
                g.set(x, h + 1, 'n')      # paillage
        return obj(g)
    x = 0
    clumps = []
    while x < w:
        r = rnd.uniform(h * 0.42, h * 0.58)
        clumps.append((x + r * 0.8, h - r + 1.5 + rnd.uniform(-0.6, 0.6), r))
        x += r * 1.3
    for (cx, cy, r) in clumps:
        cells = {}
        for (xx, yy) in ellipse(cx, cy, r, r * 0.95):
            if 0 <= xx < w:
                nx, ny = (xx + 0.5 - cx) / r, (yy + 0.5 - cy) / r
                cells[(xx, yy)] = 'D7¤'[g2.shade_index((nx, ny), 'D7¤')]
        g.layer(cells, ring='¤')
    cells = [(x, y) for y in range(h + 2) for x in range(w) if g.get(x, y) in 'D']
    for (x, y) in rnd.sample(cells, len(cells) // 7):
        g.set(x, y, '«')
    if kind == 'flower':
        for (x, y) in rnd.sample(cells, len(cells) // 9):
            g.set(x, y, rnd.choice('wwÆE'))
    return obj(g)


def reeds_clump(gold=False, dry=False, h=7, seed=0):
    """Touffe de roseaux : tiges séparées (chacune cernée), épis bruns ou dorés."""
    g = Grid(9, h + 1)
    rnd = random.Random(seed)
    cols = ('®', '°') if dry else ('±', '²') if gold else ('«', 'D')
    for i, x in enumerate((1, 3, 5, 7)):
        top = rnd.randint(0, 3) + (1 if i in (0, 3) else 0)
        lean = rnd.choice((-1, 0, 0, 1)) if i in (0, 3) else 0
        for y in range(top, h + 1):
            xx = x + (lean if y < top + 2 else 0)
            g.set(xx, y, cols[0] if y < (top + h) // 2 else cols[1])
        if not dry and i == 1:
            g.set(x, top, 'N' if not gold else '²')
            g.set(x, top + 1, 'N' if not gold else '²')
    return obj(g)


def rock(w=4, h=3):
    g = Grid(w + 2, h + 2)
    g.ball((w + 2) / 2, (h + 2) / 2 + 0.3, w / 2, h / 2, '[]V', ring='A')
    return obj(g)


def lily(flower=False):
    g = Grid(6, 4)
    g.ball(3, 2, 2.6, 1.6, 'jD', ring=None)
    g.set(3, 2, '.')
    g.set(4, 1, '.')
    if flower:
        g.set(2, 1, 'w'); g.set(3, 1, 'w'); g.set(2, 0, 'w'); g.set(3, 0, 'y')
    return g3.art(g.rows(), outline=0, pal=PAL, w=6, h=4)


def butterfly(c1='y', c2='Y'):
    g = Grid(5, 4)
    g.stamp([f'{c1}.{c1}', f'{c2}A{c2}', '.A.'], 1, 0)
    return g3.art(g.rows(), outline=0, pal=PAL, w=5, h=4)


def swallow():
    im = img(7, 4)
    setpx(im, [(0, 0), (1, 1), (2, 1), (3, 2), (4, 1), (5, 1), (6, 0), (3, 3)], OUTV)
    return im


def sign_board(w=12):
    """Panneau de bois sur deux pieds (« Verger conservatoire », lignes d'écriture)."""
    g = Grid(w + 2, 10)
    g.rect(1, 1, w, 5, 'B')
    g.rect(1, 1, w, 1, 'b')
    for x in range(3, w - 1, 2):
        g.set(x, 3, 'k')
    for x in range(3, w - 3, 2):
        g.set(x, 4, 'k')
    g.rect(2, 6, 2, 8, 'N')
    g.rect(w - 1, 6, w - 1, 8, 'N')
    return obj(g)


def skep_obj():
    g = Grid(9, 10)
    v2.skep(g, 4, 3)
    return obj(g)


def gate(w=9):
    """Barrière de bois à claire-voie."""
    g = Grid(w + 2, 7)
    for x in (1, w):
        for y in range(0, 6):
            g.set(x, y, 'N')
    for y in (1, 3):
        g.rect(2, y, w - 1, y, 'b')
    g.line(2, 4, w - 1, 1, 'B')
    return obj(g)


# ---------------------------------------------------------------------------
# Toile d'un grand dessin : fond d'herbe et pose des objets (du fond vers l'avant)

class Scene:
    def __init__(self, w, h, ground=None):
        self.im = Image.new('RGBA', (w, h), C(ground) + (255,) if ground else (0, 0, 0, 0))
        self.px = self.im.load()
        self.w, self.h = w, h
        self.items = []    # (y_bas, ordre, image, x, y)

    def put(self, x, y, c, a=255):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[x, y] = C(c) + (a,)

    def get(self, x, y):
        return self.px[x, y] if 0 <= x < self.w and 0 <= y < self.h else (0, 0, 0, 0)

    def rect(self, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.put(x, y, c)

    def blob(self, cx, cy, rx, ry, c, test=None):
        for (x, y) in ellipse(cx, cy, rx, ry):
            if test is None or test(x, y):
                self.put(x, y, c)

    def tufts(self, rnd, n, box=None, cols=('j', 'J'), test=None):
        """Touffes d'herbe en V (2 px) dans la boîte."""
        x0, y0, x1, y1 = box or (0, 0, self.w - 1, self.h - 1)
        for _ in range(n):
            x, y = rnd.randint(x0, x1), rnd.randint(y0, y1)
            if test and not test(x, y):
                continue
            c = cols[rnd.randrange(len(cols))]
            self.put(x, y, c)
            self.put(x + 1, y - 1, c) if rnd.random() < 0.5 else self.put(x - 1, y - 1, c)

    def place(self, im, x, y, z=0):
        """Objet posé ; son bas (y + hauteur) règle l'ordre d'affichage."""
        self.items.append((y + im.height, z, len(self.items), im, int(x), int(y)))

    def flush(self):
        for (_, _, _, im, x, y) in sorted(self.items, key=lambda t: (t[1], t[0], t[2])):
            self.im.alpha_composite(im, (x, y)) if x >= 0 and y >= 0 else self.im.paste(im, (x, y), im)
        self.items = []
        self.px = self.im.load()

    def image(self):
        self.flush()
        return view_outline(self.im)


def scatter(rnd, n, box, min_d, taken=None, test=None, tries=600):
    """Points répartis (tirage avec rejet, déterministe)."""
    pts = list(taken or [])
    out = []
    x0, y0, x1, y1 = box
    k = 0
    while len(out) < n and k < tries:
        k += 1
        p = (rnd.uniform(x0, x1), rnd.uniform(y0, y1))
        if test and not test(*p):
            continue
        if all((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 >= min_d ** 2 for q in pts):
            pts.append(p)
            out.append(p)
    return out


# ===========================================================================
# 2. Cadrage commun de la vue (px monde) — identique à viewLayout() de src/render/valley-view.js

VIEW_W, VIEW_H = 192, 432
RECTS = {
    'combe': (0, 40, 96, 96), 'oldOrchard': (112, 56, 80, 80), 'millpond': (8, 160, 80, 64),
    'mill': (80, 168, 32, 48), 'poppies': (112, 156, 80, 80), 'farm': (72, 256, 48, 48),
    'bocage': (0, 320, 192, 64), 'brook': (24, 120, 64, 312),
}
BROOK_X0, BROOK_Y0 = 24, 120
# Tracé du ruisseau (coordonnées du sprite 64 × 312) : (y, x du milieu)
BROOK_PTS = [(0, 37), (14, 35), (30, 28), (40, 22), (47, 21), (97, 19), (104, 18), (122, 15), (140, 15),
             (160, 21), (184, 25), (200, 24), (226, 22), (238, 22), (264, 18), (290, 14), (312, 12)]
POND_SKIP = (48, 96)            # le ruisseau n'est pas dessiné là : l'eau de l'étang prend le relais
ROAD_Y = (26, 37)               # chemin creux, en px du bocage (monde 346 à 357)
BAND_HALF = 13                  # demi-largeur de la bande du ruisseau dans le bocage


def brook_cx(sy):
    pts = BROOK_PTS
    for (y0, x0), (y1, x1) in zip(pts, pts[1:]):
        if y0 <= sy <= y1:
            t = (sy - y0) / (y1 - y0)
            t = t * t * (3 - 2 * t)
            base = x0 + (x1 - x0) * t
            break
    else:
        base = pts[-1][1]
    wig = 0 if POND_SKIP[0] - 8 <= sy <= POND_SKIP[1] + 8 or 214 <= sy <= 250 else 1.6 * math.sin(sy / 8.5)
    return base + wig


def brook_band(bocage_y):
    """Bande (x0, x1) laissée au ruisseau sur une ligne du bocage (px du bocage)."""
    sy = 200 + bocage_y
    cx = BROOK_X0 + brook_cx(sy)
    return int(cx - BAND_HALF), int(cx + BAND_HALF)


def pond_inlet_x():
    return int(round(BROOK_X0 + brook_cx(POND_SKIP[0]) - RECTS['millpond'][0]))


def pond_outlet_x():
    return int(round(BROOK_X0 + brook_cx(POND_SKIP[1]) - RECTS['millpond'][0]))


def grass_scene(w, h, seed, tufts=1.0, ground='G'):
    """Toile d'herbe (les trois verts recolorés par saison) : fond G, touffes claires et sombres."""
    sc = Scene(w, h, ground)
    rnd = random.Random(seed)
    sc.tufts(rnd, int(w * h / 26 * tufts))
    return sc, rnd


# ===========================================================================
# 3. Les lieux

def combe(step):
    """Le bois de la Combe (96 × 96) : coupe rase → jeunes plants → bois clair → vieille futaie.
    La source du ruisseau est en bas, vers x 60 : on y garde une petite clairière."""
    W = H = 96
    sc, rnd = grass_scene(W, H, 100 + step, tufts=0.9 if step else 0.5)
    src = (BROOK_X0 + brook_cx(4) - RECTS['combe'][0], 90)
    keep = lambda x, y: (x - src[0]) ** 2 + ((y - src[1]) * 1.2) ** 2 > 15 ** 2
    if step == 0:
        # sol retourné : ornières, plaques de terre nue, herbe sèche
        for _ in range(14):
            cx, cy = rnd.uniform(4, 92), rnd.uniform(4, 92)
            sc.blob(cx, cy, rnd.uniform(3, 7), rnd.uniform(2, 4), 'n' if rnd.random() < 0.5 else '®')
        for _ in range(40):
            x, y = rnd.randint(0, 95), rnd.randint(0, 95)
            sc.put(x, y, '°'); sc.put(x + 1, y - 1, '®')
        pts = scatter(rnd, 14, (2, 2, 86, 84), 10, test=keep)
        for i, (x, y) in enumerate(pts):
            sc.place(stump(rnd.choice((0, 1, 1))), x, y)
        for (x, y) in scatter(rnd, 7, (0, 0, 84, 86), 12, taken=pts, test=keep):
            sc.place(bramble(rnd.randint(0, 99)), x, y)
        sc.place(log_pile(), 70, 10)
        sc.place(log_pile(), 8, 70)
    elif step == 1:
        for _ in range(8):
            sc.blob(rnd.uniform(4, 92), rnd.uniform(4, 92), rnd.uniform(2, 4), 2, 'n')
        rows_ = []
        for r in range(7):
            y = 4 + r * 12
            for c in range(9):
                x = 3 + c * 10 + (5 if r % 2 else 0) + rnd.uniform(-1.5, 1.5)
                if keep(x + 3, y + 8) and x < 90 and rnd.random() < 0.7:
                    rows_.append((x, y + rnd.uniform(-1, 1)))
        for i, (x, y) in enumerate(rows_):
            sc.place(sapling(stake=i % 3 != 0, tube=i % 3 == 0), x, y)
        for (x, y) in ((0, 48), (76, 16), (40, 66), (84, 60), (20, 6), (56, 30)):
            sc.place(hazel(), x, y)
        for (x, y) in ((22, 24), (60, 46), (8, 80)):
            sc.place(stump(0), x, y)
    elif step == 2:
        # sentier de terre qui serpente
        for y in range(H):
            x = 30 + 10 * math.sin(y / 14.0)
            for dx in range(-1, 2):
                sc.put(int(x + dx), y, 'b' if dx else 'k')
        sc.tufts(rnd, 30, cols=('w', 'y', 'P'), test=lambda x, y: rnd.random() < 0.6)
        pts = scatter(rnd, 13, (-2, -6, 88, 76), 13,
                      test=lambda x, y: keep(x + 6, y + 12) and abs(x + 5 - (30 + 10 * math.sin((y + 14) / 14.0))) > 7)
        for i, (x, y) in enumerate(pts):
            if i % 2:
                sc.place(birch(13 + i % 3, seed=i), x, y)
            else:
                sc.place(tree_round(4.6 + (i % 3) * 0.5, '«D7', trunk=3, seed=i), x, y)
        for (x, y) in ((70, 70), (8, 60)):
            sc.place(hazel(), x, y)
    else:
        # sous-bois sombre, mousse, fougères, rais de lumière
        for y in range(H):
            for x in range(W):
                if (x * 7 + y * 13) % 11 == 0:
                    sc.put(x, y, 'J')
        for _ in range(30):
            sc.blob(rnd.uniform(0, 96), rnd.uniform(0, 96), rnd.uniform(2, 4), rnd.uniform(1, 2), '³')
        for _ in range(26):
            x, y = rnd.randint(2, 92), rnd.randint(2, 92)
            for (dx, dy) in ((0, 0), (-1, -1), (1, -1), (-2, -1), (2, -1), (0, -2)):
                sc.put(x + dx, y + dy, 'D' if dy < 0 else '7')
        pts = scatter(rnd, 16, (-8, -12, 82, 70), 15, test=lambda x, y: keep(x + 11, y + 22))
        for i, (x, y) in enumerate(sorted(pts, key=lambda p: p[1])):
            ramp = '«DD7¤' if i % 3 else 'µ«D7¤'          # chênes et hêtres (plus clairs)
            sc.place(tree_big(8.5 + (i % 3) * 0.9, ramp, seed=i, moss=True), x, y)
        for (x, y) in scatter(rnd, 18, (2, 2, 92, 92), 9):   # taches de soleil au sol
            sc.blob(x, y, 2.2, 1.2, 'j')
            sc.put(int(x), int(y), (226, 236, 150))
    return sc.image()


def orchard(step):
    """Le verger conservatoire (80 × 80) : vieux pommiers et herbe haute → arbres taillés et étiquetés → en fleurs →
    verger soigné, banc, panneau."""
    W = H = 80
    sc, rnd = grass_scene(W, H, 200 + step, tufts=2.2 if step == 0 else 0.8)
    grid_pts = [(4, 2), (28, 0), (54, 4), (14, 24), (40, 22), (62, 28), (2, 46), (28, 46), (52, 50)]
    if step == 0:
        for _ in range(140):
            x, y = rnd.randint(0, 79), rnd.randint(0, 79)
            c = rnd.choice(('j', 'J', '®', 'J'))
            for k in range(3):
                sc.put(x, y - k, c)
        for i, (x, y) in enumerate(grid_pts):
            if i in (5, 7):
                sc.place(stump(1), x + 3, y + 10)
                continue
            sc.place(apple_tree('old', seed=i), x + rnd.randint(-2, 2), y + rnd.randint(-1, 2))
        sc.place(fence_down(), 4, 70)
        sc.place(fence_down(), 46, 72)
        sc.place(bramble(3), 66, 64)
    else:
        kind = {1: 'pruned', 2: 'bloom', 3: 'tended'}[step]
        if step >= 2:
            sc.tufts(rnd, 40, cols=('w', 'y') if step == 2 else ('w', 'y', 'P'))
        if step == 2:
            for _ in range(70):   # pétales tombés
                sc.put(rnd.randint(0, 79), rnd.randint(0, 79), rnd.choice(('w', 'Æ')))
        for i, (x, y) in enumerate(grid_pts):
            if step == 3 and i == 7:
                continue
            sc.place(apple_tree(kind, seed=i), x, y)
            sc.place(label_post(), x + 10, y + 11)
        if step == 3:
            sc.place(sign_board(14), 28, 62)
            sc.place(small_bench(8), 4, 68)
            sc.place(skep_obj(), 66, 66)
            for x in range(0, 80, 1):   # allée tondue
                sc.put(x, 44 if x % 7 else 45, 'j')
    return sc.image()


def poppies(step):
    """La prairie des Coquelicots (80 × 80) : friche jaune et cailloux → prairie verte → coquelicots et bleuets →
    prairie haute aux orchidées, papillons, piquets."""
    W = H = 80
    sc, rnd = grass_scene(W, H, 300 + step, tufts=1.0)
    if step == 0:
        for _ in range(26):
            sc.blob(rnd.uniform(0, 80), rnd.uniform(0, 80), rnd.uniform(4, 9), rnd.uniform(3, 6), '®')
        for _ in range(160):
            x, y = rnd.randint(0, 79), rnd.randint(0, 79)
            sc.put(x, y, '°'); sc.put(x, y - 1, '®')
        for (x, y) in scatter(rnd, 10, (2, 2, 74, 74), 12):
            sc.place(rock(rnd.choice((3, 4, 5)), rnd.choice((2, 3))), x, y)
        for _ in range(30):
            sc.put(rnd.randint(0, 79), rnd.randint(0, 79), ']')
    elif step == 1:
        sc.tufts(rnd, 220)
        for _ in range(10):
            sc.blob(rnd.uniform(0, 80), rnd.uniform(0, 80), rnd.uniform(3, 6), rnd.uniform(2, 3), 'j')
        for _ in range(4):
            sc.blob(rnd.uniform(0, 80), rnd.uniform(0, 80), rnd.uniform(2, 4), rnd.uniform(1, 2), '®')
        for _ in range(40):
            x, y = rnd.randint(1, 78), rnd.randint(1, 78)
            c = rnd.choice(('w', 'y', 'E'))
            sc.put(x, y, c)
    elif step == 2:
        sc.tufts(rnd, 160)
        for _ in range(230):
            x, y = rnd.randint(1, 78), rnd.randint(1, 78)
            if rnd.random() < 0.72:      # coquelicot : 2 px rouges, cœur sombre
                sc.put(x, y, 'E'); sc.put(x + 1, y, 'E'); sc.put(x, y - 1, 'p'); sc.put(x + 1, y + 1, 'q')
            else:                         # bleuet
                sc.put(x, y, ':'); sc.put(x, y - 1, 'C')
            sc.put(x, y + 1, 'J')
    else:
        for _ in range(520):              # herbe haute : brins de 2 à 4 px
            x, y = rnd.randint(0, 79), rnd.randint(2, 79)
            hgt = rnd.randint(2, 4)
            lean = rnd.choice((-1, 0, 1))
            for k in range(hgt):
                sc.put(x + (lean if k == hgt - 1 else 0), y - k, 'J' if k == 0 else 'j')
        for _ in range(110):
            x, y = rnd.randint(1, 78), rnd.randint(1, 78)
            r_ = rnd.random()
            if r_ < 0.4:                  # orchidée : épi mauve
                for k in range(3):
                    sc.put(x, y - k, 'P' if k else 'Q')
                sc.put(x, y + 1, 'J')
            elif r_ < 0.65:
                sc.put(x, y, 'E'); sc.put(x + 1, y, 'E')
            elif r_ < 0.8:
                sc.put(x, y, ':')
            else:
                sc.put(x, y, 'w'); sc.put(x, y - 1, 'y')
        for (x, y) in ((10, 6), (64, 14), (34, 40), (12, 62), (60, 66)):
            sc.place(stake(), x, y)
        for (x, y, c1, c2) in ((22, 16, 'y', 'Y'), (50, 30, 'w', 's'), (66, 46, 'C', ':'), (30, 60, 'y', 'Y'),
                               (8, 36, 'P', 'Q')):
            sc.place(butterfly(c1, c2), x, y, z=1)
    return sc.image()


def pond_shape(x, y):
    """Forme de l'étang (px de l'étang 80 × 64) : ellipse irrégulière + entrée et sortie du ruisseau."""
    cx, cy, rx, ry = 36, 32, 30.5, 23
    wob = 1.2 * math.sin(math.atan2(y - cy, x - cx) * 5)
    d = math.hypot((x + 0.5 - cx) / (rx + wob), (y + 0.5 - cy) / (ry + wob))
    if d <= 1:
        return d
    xi, xo = pond_inlet_x(), pond_outlet_x()
    if y < 12 and abs(x - xi) <= 3:
        return 0.95
    if y > 52 and abs(x - xo) <= 3:
        return 0.95
    return None


def millpond(step):
    """L'étang du moulin (80 × 64) : vase craquelée et roseaux secs → eau claire → nénuphars et banc →
    grande roselière dorée et hirondelles. Le moulin se pose sur sa rive droite."""
    W, H = 80, 64
    sc, rnd = grass_scene(W, H, 400 + step, tufts=0.8)
    seeds = [(rnd.uniform(4, 70), rnd.uniform(6, 58)) for _ in range(26)]
    for y in range(H):
        for x in range(W):
            d = pond_shape(x, y)
            if d is None:
                # berge : liseré de terre autour de l'eau
                near = any(pond_shape(x + dx, y + dy) is not None for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
                if near:
                    sc.put(x, y, 'V' if step == 0 else 'n')
                continue
            if step == 0:
                ds = sorted((x - sx) ** 2 + (y - sy) ** 2 for (sx, sy) in seeds)
                crack = math.sqrt(ds[1]) - math.sqrt(ds[0]) < 0.9
                sc.put(x, y, '©' if crack else ('§' if d < 0.8 else '°'))
            else:
                if d > 0.9:
                    c = 'c'
                elif d > 0.75:
                    c = 'C'
                else:
                    c = 'u' if step == 3 else 'C' if d > 0.45 else 'É'
                sc.put(x, y, c)
    if step >= 1:
        for _ in range(26):   # reflets
            x, y = rnd.randint(8, 64), rnd.randint(12, 52)
            if pond_shape(x, y) is not None and pond_shape(x, y) < 0.8:
                sc.put(x, y, 'c'); sc.put(x + 1, y, 'c')
    if step == 0:
        for (x, y) in ((6, 30), (10, 14), (60, 50), (22, 50), (52, 8)):
            sc.place(reeds_clump(dry=True, seed=x), x - 3, y - 6)
        for (x, y) in scatter(rnd, 4, (14, 16, 56, 46), 10):
            sc.place(rock(3, 2), x, y)
    elif step == 1:
        for (x, y) in ((6, 28), (14, 48), (56, 52)):
            sc.place(reeds_clump(seed=x), x - 3, y - 6)
    elif step == 2:
        for (x, y) in scatter(rnd, 11, (12, 14, 58, 48), 7, test=lambda x, y: (pond_shape(x + 3, y + 2) or 2) < 0.8):
            sc.place(lily(flower=rnd.random() < 0.6), x, y)
        for (x, y) in ((6, 28), (12, 46), (58, 50)):
            sc.place(reeds_clump(seed=x), x - 3, y - 6)
        sc.place(small_bench(8), 1, 56)
    else:
        # roselière dorée : bande épaisse le long de la rive gauche et du haut
        for (x, y) in scatter(rnd, 34, (2, 6, 40, 58), 3.2,
                              test=lambda x, y: (pond_shape(x, y) or 0) > 0.62 and (x < 26 or y < 20)):
            sc.place(reeds_clump(gold=True, h=rnd.randint(6, 8), seed=int(x * 7 + y)), x - 3, y - 7)
        for (x, y) in scatter(rnd, 5, (20, 22, 56, 46), 9, test=lambda x, y: (pond_shape(x + 3, y + 2) or 2) < 0.7):
            sc.place(lily(flower=True), x, y)
        for (x, y) in ((44, 14), (54, 22), (36, 26)):
            sc.place(swallow(), x, y, z=2)
    return sc.image()


def mill(step, frame=0):
    """Le moulin (32 × 48, fond transparent) : en ruine (roue cassée, toit troué) ; restauré (tuiles, roue à aubes
    qui tourne : 2 images). La roue est du côté de l'étang (à gauche)."""
    W, H = 32, 48
    g = Grid(W, H)
    x0, x1 = 12, 30
    v2.stone_wall(g, x0, 20, x1, 44, seed=7)
    if step == 0:
        # trous dans le mur, lierre
        for (x, y) in ((14, 24), (15, 24), (14, 25), (26, 30), (27, 30), (27, 31), (20, 38)):
            g.set(x, y, 'H')
        for (x, y) in ((12, 32), (13, 33), (12, 34), (13, 36), (12, 37), (29, 26), (30, 27), (30, 28)):
            g.set(x, y, '7' if (x + y) % 2 else 'D')
        # charpente à nu, quelques tuiles
        g.line(x0 - 1, 21, 21, 8, 'N')
        g.line(21, 8, x1 + 1, 21, 'N')
        for k in range(3):
            g.line(14 + k * 5, 19, 19 + k * 2, 11, 'B')
        v2.roof(g, x1 - 7, x1, 15, 20, ramp='RRq')
        for (x, y) in ((24, 15), (25, 15), (23, 16)):
            g.set(x, y, '.')
        g.rect(19, 36, 22, 44, 'N')       # porte arrachée
        g.rect(20, 37, 21, 44, 'H')
    else:
        for y in range(8, 21):            # toit de tuiles en bâtière, pignon
            inset = max(0, 20 - y) * 0.75
            for x in range(int(x0 - 1 + inset), int(x1 + 2 - inset)):
                g.set(x, y, 'R' if (y % 3) else 'q')
        v2.roof(g, x0 - 1, x1 + 1, 16, 21, ramp='RRq')
        g.rect(20, 7, 21, 8, 'N')
        v2.door(g, 19, 37, h=8)
        v2.window(g, 24, 26)
        g.rect(15, 25, 17, 27, 'N')
        g.set(16, 26, 'c')
    # la roue (centre 8, 34 ; rayon 8)
    cx, cy, R = 7.5, 34.5, 7.6
    if step == 0:
        for a in range(0, 360, 6):
            if 200 < a < 290:
                continue                   # morceau manquant
            x = cx + R * math.cos(math.radians(a))
            y = cy + R * math.sin(math.radians(a))
            g.set(int(x), int(y), 'N')
        for a in (20, 110, 160):
            g.line(int(cx), int(cy), int(cx + (R - 1) * math.cos(math.radians(a))),
                   int(cy + (R - 1) * math.sin(math.radians(a))), 'B')
        g.line(2, 46, 9, 44, 'N')          # aube tombée
    else:
        off = 22.5 if frame else 0
        for a in range(0, 360, 5):
            for rr in (R, R - 1):
                x = cx + rr * math.cos(math.radians(a))
                y = cy + rr * math.sin(math.radians(a))
                g.set(int(round(x)), int(round(y)), 'N' if rr == R else 'B')
        for k in range(8):
            a = math.radians(off + k * 45)
            g.line(int(round(cx)), int(round(cy)), int(round(cx + (R - 1) * math.cos(a))),
                   int(round(cy + (R - 1) * math.sin(a))), 'b')
            px_, py_ = cx + (R + 1.2) * math.cos(a), cy + (R + 1.2) * math.sin(a)
            g.set(int(round(px_)), int(round(py_)), 'B')   # aubes
        g.rect(7, 34, 8, 35, 'N')
        # éclaboussures au pied de la roue
        for (x, y) in ((1, 44), (3, 45), (12, 45), (14, 44)):
            g.set(x, y, 'c' if frame == (x % 2) else 'w')
    return view_outline(obj(g))


def bocage(step):
    """Le bocage du chemin creux (192 × 64, bande du bas) : talus nus et chemin poussiéreux → jeunes haies replantées
    → haies épaisses, talus fleuris, barrières → vieux saules têtards, haies hautes. La bande du ruisseau reste
    transparente (le ruisseau y dessine son passage), le chemin de la ferme traverse en x 90 à 102."""
    W, H = 192, 64
    sc, rnd = grass_scene(W, H, 500 + step, tufts=0.7)
    r0, r1 = ROAD_Y
    lane = (90, 102)
    # talus : bandes au-dessus et au-dessous du chemin
    for x in range(W):
        for y in range(r0 - 6, r0):
            sc.put(x, y, ('n' if (x + y) % 5 else 'N') if step == 0 else ('J' if y < r0 - 3 else 'n'))
        for y in range(r1 + 1, r1 + 6):
            sc.put(x, y, ('n' if (x * 3 + y) % 6 else 'N') if step == 0 else ('n' if y == r1 + 1 else 'J'))
        for y in range(r0, r1 + 1):
            c = 'k' if step == 0 else 'b'
            if (x * 5 + y * 3) % 9 == 0:
                c = 'f' if step == 0 else 'B'
            if y in (r0, r1):
                c = 'B'
            sc.put(x, y, c)
    # le chemin de la ferme (vertical) rejoint le chemin creux
    for y in range(0, H):
        if r0 - 6 <= y <= r1 + 5 and not (r0 <= y <= r1):
            for x in range(lane[0] + 2, lane[1] - 1):
                sc.put(x, y, 'b')
        elif not (r0 <= y <= r1):
            for x in range(lane[0] + 2, lane[1] - 1):
                sc.put(x, y, (212, 160, 106) if x in (lane[0] + 2, lane[1] - 2) else (240, 200, 140))
    if step == 0:
        for _ in range(60):   # poussière
            sc.put(rnd.randint(0, 191), rnd.randint(r0, r1), 'l')
        for (x, y) in ((14, 6), (62, 46), (130, 4), (170, 48), (110, 50)):
            sc.place(stump(0), x, y)
        for _ in range(60):
            x, y = rnd.randint(0, 191), rnd.randint(0, 63)
            if not (r0 - 6 <= y <= r1 + 5):
                sc.put(x, y, '®')
    if step >= 2:
        for _ in range(120):  # talus fleuris
            x = rnd.randint(0, 191)
            y = rnd.choice((rnd.randint(r0 - 5, r0 - 1), rnd.randint(r1 + 2, r1 + 5)))
            sc.put(x, y, rnd.choice(('w', 'y', 'E', 'P', 'w')))
    band_ok = lambda x0, x1, y: (x1 < brook_band(y)[0] - 1 or x0 > brook_band(y)[1] + 1) and \
        (x1 < lane[0] or x0 > lane[1])
    if step >= 1:
        kind = {1: 'young', 2: 'flower', 3: 'thick'}[step]
        hh = {1: 6, 2: 9, 3: 12}[step]
        for (ytop, ybot) in ((r0 - 6 - hh - 1, r0 - 4), (r1 + 3, H - 1)):
            segs = []
            x = 0
            cuts = sorted([brook_band(ytop + 4)[0] - 2, brook_band(ytop + 4)[1] + 2, lane[0], lane[1]])
            bounds = [(0, cuts[0]), (cuts[1], cuts[2]), (cuts[3], W)]
            for (a, b) in bounds:
                if b - a < 8:
                    continue
                if step >= 2 and b - a > 60:   # une barrière dans les longues haies
                    mid = a + (b - a) // 2
                    segs += [(a, mid - 6), (mid + 6, b)]
                    sc.place(gate(9), mid - 5, ybot - 6 if ytop < r0 else ytop + 2, z=0)
                else:
                    segs.append((a, b))
            for (a, b) in segs:
                if b - a < 6:
                    continue
                hs = hedge_strip(b - a, hh, kind, seed=a + ytop)
                yy = ybot - hs.height + 1 if ytop < r0 else ytop
                sc.place(hs, a, yy)
    if step == 3:
        for x in (8, 54, 112, 150, 178):
            for (y, side) in ((r0 - 17, 0), (r1 - 1, 1)):
                if (x // 8 + side) % 2 and band_ok(x, x + 14, y + 10):
                    sc.place(pollard_willow(seed=x), x, y, z=1)
    im = sc.image()
    # bande du ruisseau : transparente
    px = im.load()
    for y in range(H):
        b0, b1 = brook_band(y)
        for x in range(max(0, b0), min(W, b1 + 1)):
            px[x, y] = (0, 0, 0, 0)
    return im


def brook(step):
    """Le Ru des Saules (64 × 312, fond transparent) : lit de cailloux sec → mince filet → eau vive, cascades, jeunes
    saules → eau claire et profonde, truites, saules feuillus → même eau et pont de pierre sur le chemin creux."""
    W, H = 64, 312
    sc = Scene(W, H)
    rnd = random.Random(600 + step)
    road0, road1 = 200 + ROAD_Y[0], 200 + ROAD_Y[1]
    in_pond = lambda y: POND_SKIP[0] <= y <= POND_SKIP[1]
    hw_of = {0: 0.0, 1: 1.0, 2: 2.6, 3: 3.6, 4: 3.6}
    for y in range(H):
        if in_pond(y):
            continue
        cx = brook_cx(y)
        grow = min(1.0, y / 260)
        hw = hw_of[step] + (0.9 * grow if step >= 2 else 0)
        if y < 14:
            hw *= 0.6
        bed = (hw + 2.2) if step else 3.6 + grow
        bank = bed + 1.6
        for x in range(W):
            d = abs(x + 0.5 - cx)
            if d > bank + 1:
                continue
            h_ = (x * 31 + y * 17) % 13
            if d <= hw:
                if step == 1:
                    c = 'c' if h_ < 4 else 'C'
                elif step == 2:
                    c = 'c' if (h_ < 3 or d > hw - 0.8) else 'C'
                else:
                    c = 'É' if d < hw * 0.45 else ('c' if d > hw - 0.7 else 'C')
                    if h_ == 0:
                        c = 'c'
                sc.put(x, y, c)
            elif d <= bed:
                if step == 0:
                    c = ('W' if h_ < 2 else '[' if h_ < 5 else ']' if h_ < 7 else '§' if h_ < 10 else '®')
                elif step == 1:
                    c = ('W' if h_ < 2 else '[' if h_ < 4 else ']' if h_ < 6 else '§')
                else:
                    c = ('[' if h_ < 3 else ']' if h_ < 5 else 'n' if h_ < 9 else 'J')
                sc.put(x, y, c)
            elif d <= bank:
                c = ('°' if h_ < 6 else '®') if step <= 1 else ('J' if h_ < 9 else 'D')
                sc.put(x, y, c)
            elif d <= bank + 1 and h_ < 5:
                sc.put(x, y, 'J' if step >= 2 else '°')
    # la source, dans le bois
    sx, sy = brook_cx(3), 3
    if step == 0:
        sc.blob(sx, sy + 1, 4.5, 3, '§')
        sc.blob(sx, sy + 1, 2.5, 1.6, '©')
    else:
        sc.blob(sx, sy + 1, 5, 3.4, 'C' if step < 3 else 'É')
        sc.blob(sx - 1, sy, 2.4, 1.2, 'c')
    for a in range(0, 360, 50):
        sc.place(rock(2, 2), sx + 5.8 * math.cos(math.radians(a)) - 2, sy + 1 + 3.8 * math.sin(math.radians(a)) - 2)
    if step >= 2:
        # petites cascades : marches de pierres et écume
        for cy in (24, 150, 280):
            cx = brook_cx(cy)
            hw = hw_of[step] + 0.6
            for x in range(int(cx - hw - 1), int(cx + hw + 2)):
                sc.put(x, cy, ']')
                sc.put(x, cy + 1, 'w' if (x + step) % 2 else 'c')
                sc.put(x, cy + 2, 'w' if x % 3 == 0 else 'c')
            sc.place(rock(2, 2), cx - hw - 3, cy - 2)
            sc.place(rock(2, 2), cx + hw - 1, cy - 2)
    if step >= 3:
        # ombres de truites
        for ty in (70 + 60, 168, 196, 262, 298):
            if in_pond(ty):
                continue
            cx = brook_cx(ty)
            for (dx, dy) in ((-1, 0), (0, 0), (1, 0), (2, 0), (0, -1), (-2, 0)):
                sc.put(int(cx + dx), ty + dy, 'È')
    # le chemin creux traverse : gué, passerelle ou pont
    for y in range(road0, road1 + 1):
        cx = brook_cx(y)
        x0, x1 = int(BROOK_X0 + cx - BAND_HALF) - BROOK_X0, int(BROOK_X0 + cx + BAND_HALF) - BROOK_X0
        hw = hw_of[step] + 0.9 * min(1.0, y / 260) + 2.5
        for x in range(x0, x1 + 1):
            if step >= 1 and abs(x + 0.5 - cx) <= hw:
                continue
            c = 'k' if step == 0 else 'b'
            if y in (road0, road1):
                c = 'B'
            sc.put(x, y, c)
    cxr = brook_cx((road0 + road1) // 2)
    if step in (1, 2):           # gué : pierres de passage
        for k, y in enumerate(range(road0 + 1, road1, 3)):
            sc.place(rock(2, 1), cxr - 3 + (k % 2) * 3, y - 1)
    elif step == 3:              # passerelle de planches
        g = Grid(16, 14)
        for y in range(2, 12):
            g.rect(2, y, 13, y, 'b' if y % 2 else 'B')
        for x in (1, 14):
            g.rect(x, 0, x, 12, 'N')
        im = view_outline(obj(g))
        sc.place(im, cxr - 8, road0 - 1, z=1)
    elif step == 4:              # pont de pierre en dos d'âne
        g = Grid(22, 20)
        for y in range(3, 15):                     # tablier : le chemin continue
            for x in range(2, 20):
                g.set(x, y, 'B' if y in (3, 14) else ('b' if (x * 5 + y * 3) % 7 else 'k'))
        for (y0, y1) in ((1, 2), (15, 16)):       # parapets de pierre
            for x in range(1, 21):
                blk = (x // 3) % 2
                g.set(x, y0, 'W' if x % 3 == 1 else '[')
                g.set(x, y1, '[' if blk else ']')
            for x in range(3, 21, 3):
                g.set(x, y1, 'V')
        for (x0, x1) in ((0, 1), (20, 21)):       # culées
            for y in range(1, 17):
                for x in range(x0, x1 + 1):
                    g.set(x, y, '[' if (y // 2) % 2 else ']')
        for x in range(5, 17):                     # ombre de l'arche sur l'eau
            g.set(x, 17, 'É')
            if 7 <= x <= 14:
                g.set(x, 18, 'É')
        im = view_outline(obj(g))
        sc.place(im, cxr - 11, road0 - 4, z=1)
    # roseaux, saules et cailloux le long des rives
    banks = []
    for y in range(18, H - 16, 7):
        if in_pond(y) or POND_SKIP[0] - 10 < y < POND_SKIP[0] + 2 or road0 - 16 < y < road1 + 4:
            continue
        banks.append(y)
    if step <= 1:
        for y in banks[::3]:
            side = -1 if (y // 7) % 2 else 1
            sc.place(reeds_clump(dry=True, h=5, seed=y), brook_cx(y) + side * 7 - 3, y - 5)
    else:
        for y in banks[::2]:
            side = -1 if (y // 7) % 2 else 1
            sc.place(reeds_clump(h=6, seed=y), brook_cx(y) + side * (hw_of[step] + 5) - 3, y - 6)
        spots = [(30, 1), (112, 1), (148, 1), (168, -1), (190, 1), (276, 1), (296, -1)]
        for (y, side) in spots:
            cx = brook_cx(y)
            if step == 2:
                im = willow('young', seed=y)
                sc.place(im, cx + side * 10 - im.width // 2, y - im.height + 2)
            else:
                im = willow('leafy', seed=y)
                x = cx + side * 13 - im.width // 2
                x = max(-2, min(W - im.width + 2, x))
                sc.place(im, x, y - im.height + 3)
    im = sc.image()
    return im


def farm(n):
    """La ferme vue de loin (48 × 48) : 1 petite ferme (maison, un champ) ; 2 ferme moyenne (grange, champs en damier) ;
    3 grande ferme (verger, mare) ; 4 le Domaine (manoir au fanion doré, haies tout autour)."""
    sc, rnd = grass_scene(48, 48, 700 + n, tufts=0.6)
    # cour de terre et chemin vers le bas
    sc.blob(24, 33, 6, 3, 'b')
    sc.blob(24, 33, 5, 2, 'k')
    for y in range(34, 48):
        for x in range(22, 27):
            sc.put(x, y, 'k' if 22 < x < 26 else 'b')

    def field(x0, y0, w, h, kind):
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w):
                if kind == 'soil':
                    c = 'n' if (y - y0) % 2 else 'N'
                elif kind == 'wheat':
                    c = 'y' if (y - y0) % 2 else 'Y'
                else:
                    c = 'D' if (y - y0) % 2 else 'd'
                sc.put(x, y, c)
        for x in range(x0 - 1, x0 + w + 1):
            sc.put(x, y0 - 1, 'J'); sc.put(x, y0 + h, 'J')

    def house(x, y, big=False, roof='R'):
        g = Grid(16 if big else 12, 13 if big else 11)
        w = g.w
        hgt = g.h
        for yy in range(0, 5 if big else 4):
            inset = max(0, 4 - yy) if big else max(0, 3 - yy)
            for xx in range(inset, w - inset):
                g.set(xx, yy, roof if yy % 2 else ('q' if roof == 'R' else 'z'))
        g.rect(1, 5 if big else 4, w - 2, hgt - 2, 'k')
        g.rect(w - 3, 5 if big else 4, w - 2, hgt - 2, 'b')
        g.rect(w // 2 - 1, hgt - 5, w // 2, hgt - 2, 'N')
        g.set(2, (6 if big else 5) + 1, 'c'); g.set(w - 4, (6 if big else 5) + 1, 'c')
        if big:
            g.set(4, 8, 'c'); g.set(11, 8, 'c')
        sc.place(view_outline(obj(g)), x, y)

    def barn(x, y):
        g = Grid(14, 12)
        for yy in range(0, 4):
            inset = max(0, 3 - yy)
            for xx in range(inset, 14 - inset):
                g.set(xx, yy, 'N' if yy % 2 else 'H')
        g.rect(1, 4, 12, 10, 'R')
        g.rect(10, 4, 12, 10, 'q')
        g.rect(5, 6, 8, 10, 'H')
        g.line(5, 6, 8, 10, 'w'); g.line(8, 6, 5, 10, 'w')
        sc.place(view_outline(obj(g)), x, y)

    if n == 1:
        field(4, 6, 14, 10, 'soil')
        house(19, 21)
        sc.place(tree_round(3.4, '«D7', trunk=2), 34, 22)
    elif n == 2:
        field(2, 4, 10, 7, 'wheat'); field(13, 4, 10, 7, 'green')
        field(2, 13, 10, 7, 'green'); field(13, 13, 10, 7, 'soil')
        house(19, 21)
        barn(32, 18)
        sc.place(tree_round(3.2, '«D7', trunk=2), 2, 30)
    elif n == 3:
        field(2, 3, 9, 6, 'wheat'); field(12, 3, 9, 6, 'green')
        field(2, 11, 9, 6, 'soil'); field(12, 11, 9, 6, 'wheat')
        house(17, 19, big=True)
        barn(32, 4)
        sc.blob(9, 37, 6, 3.5, 'C')            # mare
        sc.blob(8, 36, 2.5, 1, 'c')
        for (x, y) in ((35, 20), (37, 31), (2, 18)):
            sc.place(tree_round(3.4, '«D7', trunk=2, fruit='E', seed=x), x, y)
    else:
        # haies tout autour
        sc.flush()
        field(5, 5, 8, 6, 'wheat'); field(5, 13, 8, 6, 'green')
        sc.blob(10, 34, 5, 3.2, 'C')
        sc.blob(9, 33, 2, 1, 'c')
        house(17, 19, big=True, roof='x')
        g = Grid(5, 10)                        # fanion doré sur le toit
        g.rect(0, 0, 0, 9, 'N')
        g.stamp(['yyy', 'yYy.', 'yy'], 1, 0)
        sc.place(view_outline(obj(g)), 24, 12, z=2)
        barn(30, 4)
        for (x, y) in ((33, 20), (33, 31)):
            sc.place(tree_round(3.4, '«D7', trunk=2, fruit='E', seed=x), x, y)
        for (x0, y0, w, horiz) in ((0, 0, 48, True), (0, 43, 20, True), (28, 43, 20, True)):
            sc.place(hedge_strip(w, 4, 'flower', seed=x0 + y0), x0, y0 - 1 if y0 else -1, z=1)
        for x0 in (0, 44):
            for y in range(4, 44, 4):
                g = Grid(5, 6)
                g.ball(2.5, 3, 2.2, 2.4, 'D7', ring='A')
                sc.place(view_outline(obj(g)), x0 - 1, y, z=1)
    return sc.image()


def works():
    """Chantier de la vallée (32 × 32, transparent) : piquets et ficelle, brouette, pelle, petit panneau."""
    g = Grid(32, 32)
    # piquets et ficelle
    for x in (2, 12, 22):
        g.rect(x, 18, x, 26, 'b')
        g.set(x, 18, 'k')
    for x in range(2, 23):
        g.set(x, 20 + (1 if 6 < x < 18 else 0), 'w')
    # panneau « Chantier de la vallée »
    g.rect(20, 2, 30, 9, 'B')
    g.rect(20, 2, 30, 2, 'b')
    g.rect(22, 4, 28, 4, 'k'); g.rect(22, 6, 27, 6, 'k')
    g.set(24, 7, 'D'); g.set(25, 7, 'D'); g.set(25, 6, 'D')
    g.rect(25, 10, 25, 20, 'N')
    # brouette
    g.stamp(['.SSSSSSSS', 'SsssssssS.', '.SssssssS', '..SSSSSS'], 6, 23)
    g.ball(9.5, 29.5, 1.8, 1.8, 'xz', ring='A')
    g.line(15, 24, 19, 27, 'N')
    g.rect(10, 27, 13, 28, 'n')         # terre dans la brouette ?
    g.stamp(['nnnn', 'nNNn'], 8, 22)
    # pelle plantée
    g.rect(29, 12, 29, 25, 'B')
    g.rect(28, 25, 30, 28, 's')
    g.set(28, 11, 'N'); g.set(30, 11, 'N'); g.set(29, 11, 'N')
    return obj(g)


def sprouts():
    """Trois pousses vertes (semées sur un lieu en reprise)."""
    g = Grid(16, 16)
    for (x, y, h, big) in ((3, 13, 4, False), (8, 11, 6, True), (12, 14, 3, False)):
        g.rect(x, y - h, x, y, 'D')
        g.ball(x - 1.6, y - h + 0.4, 1.8 if big else 1.4, 1.2, 'jG', ring='A')
        g.ball(x + 2.0, y - h - 0.4, 1.8 if big else 1.4, 1.2, 'jG', ring='A')
        g.stamp(['.nn.', 'nNNn'], x - 1, y + 1)
    return icon(g.rows())


def places_section():
    for s in range(5):
        add(f'place.brook.{s}', brook(s), h_px=312)
    add('place.mill.0', mill(0))
    add('place.mill.1', mill(1, 0))
    add('place.mill.1.a', mill(1, 1))
    for s in range(4):
        add(f'place.combe.{s}', combe(s))
    for s in range(4):
        add(f'place.poppies.{s}', poppies(s))
    for s in range(4):
        add(f'place.millpond.{s}', millpond(s))
    for s in range(4):
        add(f'place.bocage.{s}', bocage(s))
    for s in range(4):
        add(f'place.oldOrchard.{s}', orchard(s))
    add('place.works', works())
    add('place.sprouts', sprouts())
    for n in range(1, 5):
        add(f'view.farm.{n}', farm(n))


# ===========================================================================
# 4. Le fond de la vue (192 × 432), quatre saisons — planche à part (valley3bg)
#
# Dessiné avec les verts d'herbe Kenney puis recoloré exactement comme les planches de saison (GRASS → SEASON_GRASS) :
# les rectangles des lieux, laissés en herbe neutre, ont ainsi la couleur de l'herbe des lieux posés dessus.

BG_SKY = {
    'spring': ((140, 200, 246), (198, 234, 252)),
    'summer': ((104, 176, 240), (172, 222, 252)),
    'autumn': ((160, 184, 222), (236, 216, 190)),
    'winter': ((188, 202, 222), (234, 238, 246)),
}
BG_HILLS = {   # collines lointaines (bleues), puis plus proches
    'spring': ((150, 178, 220), (118, 160, 172)),
    'summer': ((134, 164, 214), (106, 148, 150)),
    'autumn': ((170, 160, 196), (172, 140, 112)),
    'winter': ((206, 214, 234), (178, 192, 216)),
}
PATH_C = {
    'spring': ((236, 192, 132), (206, 152, 100)),
    'summer': ((240, 200, 140), (212, 160, 106)),
    'autumn': ((220, 168, 112), (184, 124, 82)),
    'winter': ((214, 220, 236), (180, 190, 212)),
}
MAIN_PATH = [(104, 30), (104, 44), (104, 140), (101, 152), (100, 236), (97, 256), (96, 304), (96, 320),
             (96, 384), (96, 398), (110, 410), (150, 416), (192, 418)]
SIDE_PATH = [(96, 398), (92, 432)]


def bg_tree(season, r=4.0, seed=0):
    if season == 'winter':
        W, H = int(2 * r + 4), int(2 * r + 6)
        g = Grid(W, H)
        cx = W // 2
        for y in range(int(r), H - 1):
            g.set(cx, y, 'N')
        for k, (dx, dy) in enumerate(((-3, -3), (3, -3), (-2, -5), (2, -6), (0, -7))):
            g.line(cx, int(r) + 2, cx + dx, int(r) + 2 + dy, 'N')
            g.set(cx + dx, int(r) + 1 + dy, 'W')
        return obj(g)
    ramp = {'spring': '«D7', 'summer': 'D7¤', 'autumn': 'yY%'}[season]
    return tree_round(r, ramp, trunk=2, seed=seed, blossom='wÆ' if season == 'spring' and seed % 2 else None)


def polyline_cells(pts, width):
    cells = {}
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
        for i in range(n + 1):
            x = x0 + (x1 - x0) * i / n
            y = y0 + (y1 - y0) * i / n
            for dx in range(-width, width + 1):
                for dy in range(-width, width + 1):
                    if dx * dx + dy * dy <= width * width + 1:
                        q = (int(x + dx), int(y + dy))
                        d = math.hypot(dx, dy)
                        cells[q] = min(cells.get(q, 99), d)
    return cells


def background(season):
    W, H = VIEW_W, VIEW_H
    sc = Scene(W, H, 'G')
    rnd = random.Random(900 + SEASONS.index(season))
    s_hi, s_lo = BG_SKY[season]
    far, near = BG_HILLS[season]
    # ciel en bandes (dégradé tramé)
    for y in range(0, 34):
        t = y / 33
        for x in range(W):
            tt = t + (0.06 if (x + y) % 2 else -0.06)
            sc.put(x, y, lerp(s_hi, s_lo, max(0.0, min(1.0, round(tt * 4) / 4))))
    # nuages
    cloud = (255, 255, 255) if season != 'autumn' else (250, 240, 230)
    for (cx, cy, rx) in ((30, 7, 9), (120, 4, 12), (170, 12, 7), (78, 14, 5)):
        sc.blob(cx, cy, rx, 2.4, cloud)
        sc.blob(cx - rx * 0.3, cy - 1.5, rx * 0.5, 2.0, cloud)
        for x in range(int(cx - rx + 1), int(cx + rx)):
            sc.put(x, int(cy + 2), lerp(cloud, s_lo, 0.4))
    if season == 'summer':
        sc.blob(160, 5, 3.4, 3.4, (255, 236, 160))
    # collines lointaines (bleues) puis proches
    ridge1 = [int(18 + 4 * math.sin(x / 17.0 + 0.5) + 2 * math.sin(x / 7.0)) for x in range(W)]
    ridge2 = [int(27 + 4 * math.sin(x / 23.0 + 2.0) + 1.5 * math.sin(x / 9.0 + 1)) for x in range(W)]
    for x in range(W):
        for y in range(ridge1[x], 46):
            sc.put(x, y, far if y > ridge1[x] else lerp(far, (255, 255, 255), 0.35))
        for y in range(ridge2[x], 50):
            sc.put(x, y, near if y > ridge2[x] else lerp(near, (255, 255, 255), 0.25))
    # lisière de petits arbres bleutés sur la colline proche
    tree_far = lerp(near, (40, 60, 70), 0.25) if season != 'winter' else lerp(near, (120, 130, 160), 0.4)
    for x0 in range(2, W, 5):
        y0 = ridge2[x0] + 2
        sc.blob(x0, y0, 2.2, 2.0, tree_far)
        sc.put(x0 - 1, y0 - 1, lerp(tree_far, (255, 255, 255), 0.2))
    # coteau d'herbe : de y 34 à 48, l'herbe monte en vagues
    ridge3 = [int(36 + 3 * math.sin(x / 13.0 + 1.3)) for x in range(W)]
    for x in range(W):
        for y in range(ridge3[x], 56):
            sc.put(x, y, 'G')
        sc.put(x, ridge3[x], 'j')
    # herbe : touffes claires et sombres partout ; courbes de niveau des coteaux
    sc.tufts(rnd, int(W * H / 22), box=(0, 38, W - 1, H - 1))
    for k, base in enumerate((52, 146, 244, 312, 392)):
        for x in range(W):
            y = int(base + 4 * math.sin(x / 19.0 + k))
            if x % 3:
                sc.put(x, y, 'J')
    # champs voisins à droite de la ferme (bandes)
    strip = {'spring': ('n', 'D'), 'summer': ('y', 'Y'), 'autumn': ('n', 'N'), 'winter': ('W', 's')}[season]
    for i, (x0, y0, w, h) in enumerate(((128, 262, 26, 18), (158, 262, 30, 18), (128, 284, 60, 16))):
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w):
                a, b = strip if i != 1 else (('D', 'd') if season in ('summer', 'autumn') else strip)
                sc.put(x, y, a if (y - y0) % 2 else b)
        for x in range(x0 - 1, x0 + w + 1):
            sc.put(x, y0 - 1, 'J'); sc.put(x, y0 + h, 'J')
    # chemins de terre
    pc, pd = PATH_C[season]
    for (q, d) in polyline_cells(MAIN_PATH, 3).items():
        if d <= 2.2:
            sc.put(q[0], q[1], pc)
        elif d <= 3.0 and (q[0] + q[1]) % 2:
            sc.put(q[0], q[1], pd)
    for (q, d) in polyline_cells(SIDE_PATH, 2).items():
        sc.put(q[0], q[1], pc if d <= 1.4 else pd)
    for (q, d) in polyline_cells([(104, 30), (104, 44)], 1).items():
        sc.put(q[0], q[1], pc)
    # village au bout du chemin : toits et petit clocher
    vill = Grid(52, 30)
    for (x, y, w) in ((2, 14, 12), (16, 10, 14), (38, 16, 12)):
        for yy in range(0, 4):
            inset = max(0, 3 - yy)
            for xx in range(x + inset, x + w - inset):
                vill.set(xx, y + yy, 'W' if season == 'winter' and yy < 2 else 'R' if yy % 2 else 'q')
        vill.rect(x + 1, y + 4, x + w - 2, y + 9, 'k')
        vill.rect(x + w - 3, y + 4, x + w - 2, y + 9, 'b')
        vill.set(x + 3, y + 6, 'c'); vill.set(x + w - 5, y + 6, 'c')
    # clocher : tour de pierre, flèche d'ardoise, coq doré
    vill.rect(31, 6, 36, 22, '[')
    vill.rect(35, 6, 36, 22, ']')
    vill.rect(33, 10, 34, 12, 'Z')
    for i in range(6):
        vill.rect(31 + i // 2, 5 - i, 36 - i // 2, 5 - i, 'z' if season != 'winter' else 'W')
    vill.set(33, 0, 'y'); vill.set(34, 0, 'Y')
    sc.place(obj(vill), 138, 398)
    # arbres isolés et bosquets hors des lieux
    spots = [(0, 302, 4.2), (6, 236, 3.6), (180, 236, 4.0), (164, 238, 3.4), (148, 300, 3.2), (122, 238, 3.0),
             (186, 40, 3.6), (128, 42, 3.2), (4, 390, 4.0), (60, 392, 3.6), (80, 412, 3.0), (182, 304, 3.6),
             (110, 316, 3.0)]
    for i, (x, y, r) in enumerate(spots):
        im = bg_tree(season, r, seed=i)
        sc.place(im, x - im.width // 2, y - im.height + 2)
    # haie le long du chemin du village
    sc.place(hedge_strip(46, 5, 'thick' if season != 'winter' else 'young', seed=4), 112, 422, z=1)
    # fleurs, feuilles mortes, neige
    if season == 'spring':
        sc.tufts(rnd, 260, box=(0, 40, W - 1, H - 1), cols=('w', 'w', 'y', 'Æ'))
    elif season == 'summer':
        sc.tufts(rnd, 90, box=(0, 40, W - 1, H - 1), cols=('w', 'y', 'E'))
    elif season == 'autumn':
        sc.tufts(rnd, 180, box=(0, 40, W - 1, H - 1), cols=('Y', '%', 'y', '$'))
    sc.flush()
    im = sc.im
    # recoloration des verts d'herbe (comme les planches de saison)
    im = recolor(im, dict(zip(GRASS, SEASON_GRASS[season])))
    if season == 'winter':
        # ombres bleutées sous les arbres et les toits
        px = im.load()
        for y in range(H - 1):
            for x in range(W):
                if px[x, y][:3] == OUT and px[x, y + 1][:3] == SEASON_GRASS['winter'][0]:
                    px[x, y + 1] = SEASON_GRASS['winter'][2] + (255,)
    return view_outline(im)


BACKGROUNDS = {}


def bg_section():
    for s in SEASONS:
        BACKGROUNDS[s] = background(s)


# ===========================================================================
# 5. Petits objets de la vue : poteau, ponton, banc, Hélène, reflets, brume

def signpost():
    """Poteau de bois à flèche « La vallée » (16 × 32), au bord de la route de la ferme."""
    g = Grid(16, 32)
    g.rect(7, 6, 8, 29, 'B')
    g.rect(8, 6, 8, 29, 'N')
    # flèche vers la droite (la route de la vallée), petite colline peinte
    g.stamp(['bbbbbbbbbbb.', 'bkkkkkkkkkbb', 'bkDDkkkkkkkbb', 'bkDDDkkkkkbb.', 'bbbbbbbbbbb.'], 1, 6)
    g.set(4, 8, '«')
    g.rect(6, 9, 11, 9, 'N')
    # seconde planchette : petite vague (le ruisseau)
    g.stamp(['.bbbbbbbbb', 'bbkkkkkkkb', 'bkCkCkCkkb', '.bbbbbbbbb'], 4, 14)
    g.rect(5, 29, 10, 29, 'n')
    g.stamp(['.j..j', 'jJ.jJ'], 3, 28)
    g.stamp(['j.', 'Jj'], 11, 28)
    return obj(g)


def pontoon():
    """Petit ponton de bois avec une canne à pêche posée."""
    g = Grid(16, 16)
    for y in range(6, 13):
        g.rect(2, y, 13, y, 'b' if y % 2 else 'B')
    for x in (2, 13):
        g.rect(x, 12, x, 14, 'N')
    g.line(4, 7, 14, 1, 'N')                 # canne
    g.set(15, 1, 'w')
    for y in range(2, 8):
        g.set(15, y, 's') if y % 2 else None  # fil
    g.set(15, 9, 'E')                         # bouchon
    g.rect(3, 8, 5, 9, 'n')                   # boîte à appâts
    im = obj(g)
    setpx(im, [(14, 14), (12, 15), (1, 15), (3, 14)], 'c')
    return im


def view_bench():
    """Banc du belvédère (32 × 16) : planches, dossier, pieds ; une touffe de fleurs."""
    g = Grid(32, 16)
    g.rect(4, 3, 27, 4, 'B')       # dossier
    g.rect(4, 3, 27, 3, 'b')
    g.rect(4, 7, 27, 8, 'b')       # assise
    g.rect(4, 9, 27, 9, 'B')
    for x in (5, 26):
        g.rect(x, 5, x, 6, 'N')
        g.rect(x, 10, x, 13, 'N')
    for x in (9, 22):
        g.rect(x, 10, x, 12, 'N')
    g.stamp(['.w.', 'wyw', '.d.'], 28, 10)
    g.stamp(['P.', 'd.'], 1, 11)
    return obj(g)


def helene_sprite(frame):
    """Hélène (16 × 16) : ciré vert olive, bottes, cheveux gris noués, jumelles ; marche / jumelles levées."""
    rows_walk = [
        '................',
        '.....RRRR.......',
        '....RRRRRR......',
        '....RSSSSR......',
        '....SEsSEs......',
        '....SSSSSs......',
        '.....SsSs.......',
        '....ØØNNØø......',
        '...ØØØ&&Øøø.....',
        '...SØØØØØøS.....',
        '....ØØØØØø......',
        '....ØØØØøø......',
        '....ØØ.øø.......',
        '....xx..xx......',
        '....ZZ..ZZ......',
        '................',
    ]
    rows_bino = [
        '................',
        '.....RRRR.......',
        '....RRRRRR......',
        '...SS&&&&R......',
        '...Ss&&&&s......',
        '....SSSSSs......',
        '.....SsSs.......',
        '...SØØNNØøS.....',
        '...ØØØØØØøø.....',
        '...ØØØØØØøø.....',
        '....ØØØØØø......',
        '....ØØØØøø......',
        '....ØØ.øø.......',
        '....xx..xx......',
        '....ZZ..ZZ......',
        '................',
    ]
    rows = rows_bino if frame else rows_walk
    pal = dict(PAL)
    pal.update({'R': (196, 196, 204), 'S': PAL['l'], 's': PAL['e'], 'E': PAL['Z']})
    im = art(rows, outline=1, w=16, h=16, pal=pal)
    return flip(im)


def ripple(frame):
    """Reflets d'eau qui coule (16 × 16, à poser sur le ruisseau ou l'étang)."""
    im = img(16, 16)
    pts = [(2, 3), (3, 3), (4, 3), (9, 6), (10, 6), (11, 6), (12, 6), (4, 10), (5, 10), (6, 10), (11, 13), (12, 13)]
    for (x, y) in pts:
        x2 = (x + (2 if frame else 0)) % 16
        y2 = (y + (1 if frame else 0)) % 16
        im.putpixel((x2, y2), (255, 255, 255, 200))
    for (x, y) in ((1, 4), (8, 7), (3, 11), (10, 14)):
        x2 = (x + (2 if frame else 0)) % 16
        im.putpixel((x2, (y + (1 if frame else 0)) % 16), PAL['c'] + (220,))
    return im


def mist():
    """Brume du matin (32 × 16), blanc translucide, bords effilés."""
    im = img(32, 16)
    px = im.load()
    for y in range(16):
        for x in range(32):
            d = math.hypot((x + 0.5 - 16) / 15.5, (y + 0.5 - 8.5) / 5.5)
            a = max(0.0, 1 - d)
            band = 0.75 + 0.25 * math.sin(x / 3.0 + y)
            alpha = int(170 * a * band)
            if alpha > 8:
                px[x, y] = (246, 250, 255, (alpha // 24) * 24)
    return im


def portrait_helene():
    """Portrait d'Hélène (32 × 32, même gabarit que portrait.joseph) : cheveux gris noués en chignon, ciré vert
    olive au col relevé, jumelles au cou."""
    rows = gc.portrait_rows('f', False, kind='helene', expr='content')
    g = Grid(32, 32)
    for y, line in enumerate(rows):
        for x, ch in enumerate(line):
            if ch != '.':
                g.set(x, y, ch)
    cx = 16
    # cheveux gris : dessus, mèches et chignon
    for (x, y) in gc.ellipse_cells(cx + 6.5, 6.0, 3.4, 3.2):        # chignon, derrière la tête
        g.set(x, y, 'R' if x < cx + 7 else 'r')
    for (x, y) in gc.ellipse_cells(cx, 10.5, 9.0, 6.6):
        if y <= 8 or (y <= 12 and (x <= cx - 7 or x >= cx + 6)):
            g.set(x, y, 'R' if x < cx + 4 else 'r')
    for x in (cx - 5, cx - 2, cx + 1):                                  # mèches
        g.set(x, 6, 'r'); g.set(x + 1, 7, 'r')
    for x in range(cx - 6, cx + 6):
        g.set(x, 9, 'R' if (x + 1) % 4 else 'r')
    # sourcils, lunettes rondes fines
    for x in (cx - 6, cx - 5, cx - 4, cx + 3, cx + 4, cx + 5):
        g.set(x, 12, 'r')
    for x0 in (cx - 7, cx + 1):
        for (dx, dy) in ((1, 0), (2, 0), (3, 0), (0, 1), (4, 1), (0, 2), (4, 2), (1, 3), (2, 3), (3, 3)):
            g.set(x0 + dx, 13 + dy, 'x')
    g.set(cx - 2, 14, 'x'); g.set(cx - 1, 14, 'x'); g.set(cx, 14, 'x')
    # sourire
    for x in range(cx - 2, cx + 2):
        g.set(x, 19, 'M')
    g.set(cx - 3, 18, 'M'); g.set(cx + 2, 18, 'M')
    # ciré : remplace chemise et salopette ; col relevé
    for y in range(20, 32):
        for x in range(32):
            if g.get(x, y) in 'CcOo':
                g.set(x, y, 'Ø' if x < cx + 6 else 'ø')
    for (x, y) in ((cx - 5, 21), (cx - 4, 21), (cx - 5, 22), (cx + 3, 21), (cx + 4, 21), (cx + 4, 22),
                   (cx - 4, 22), (cx + 3, 22)):
        g.set(x, y, 'ø')
    for y in range(24, 32, 3):
        g.set(cx, y, 'y')                 # boutons
    # jumelles au cou : courroie et deux fûts noirs
    for (x, y) in ((cx - 4, 23), (cx - 3, 24), (cx + 3, 23), (cx + 2, 24)):
        g.set(x, y, 'N')
    for x0 in (cx - 4, cx + 1):
        g.rect(x0, 25, x0 + 2, 28, '&')
        g.set(x0, 25, '+')
        g.set(x0 + 1, 28, 'c')
    g.rect(cx - 1, 26, cx, 27, '&')
    im = gc.person(g.rows(), 0, 'grey', 'fair',
                   extra={'M': PAL['q'], 'W': PAL['w'], 'B': PAL['r'], 'G': PAL['W'],
                          'R': (200, 200, 208), 'r': (160, 160, 172), 'Ø': PAL['Ø'], 'ø': PAL['ø'],
                          '&': PAL['&'], '+': PAL['+'], 'x': PAL['x'], 'y': PAL['y'], 'N': PAL['N'], 'c': PAL['c']})
    return gc.outline_image(im)


def view_section():
    add('view.signpost', signpost())
    add('view.pontoon', pontoon())
    add('view.bench', view_bench())
    add('view.helene', helene_sprite(0))
    add('view.helene.1', helene_sprite(1))
    add('fx.ripple', ripple(0))
    add('fx.ripple.1', ripple(1))
    add('fx.mist', mist())
    add('portrait.helene', portrait_helene())


# ===========================================================================
# 6. Les dix habitants de la vallée (regard à gauche, 2 images) et leurs indices

WILD = {
    'kingfisher': ["""
................
................
................
................
......:::.......
.....:CC::......
..&&:Z$C::......
....w$$::C:.....
.....YYY:::C....
.....YYYY:::C...
......YYY:CC:...
.......YY:::....
.......y.y..:...
..NNNNNNNNNNNNN.
.............N..
................
""", """
............CC..
...........C::..
..........::C...
.........::C:...
........Y::C....
.......YY::.....
......YY::......
.....$Y::.......
....w$:Z........
....:::.........
...&&...........
..&&............
................
.c..c.cc..c.....
cwccwwccwc......
................
"""],
    'crayfish': ["""
................
................
................
................
................
................
A...............
.A..............
..ws............
.wwsS...........
..sSSZSSSSS.....
....SSSMSMSMS]].
..sSSSSSSSSS]]].
.wwsS..M.M.M....
..ws............
................
""", """
................
................
.ws.............
wwsS............
.sSS............
...SS...........
....S...........
.A...SZSSSSS....
..A.SSSMSMSMS]].
.....SSSSSSS]]].
...S...M.M.M....
..sS............
.wwsS...........
..ws............
................
................
"""],
    'otter': ["""
................
.....~~~........
....~*~~~.......
...Z~*~~~.......
..&**~~~~.......
...***~~;.......
....**~~;.......
....**~~~;......
....*~~~~;;.....
....*~~~~;;.....
....~~~~~;;;....
....~~;~~;.;;;..
...;;.;;.....;;.
................
................
................
""", """
................
................
................
................
................
................
................
..~~~...........
.Z*~~~~~~~~;....
&**~~~~~~~~~;;;.
.***~~~~~~~;;..;
cc..cccc..ccc.cc
.cwcc.cccw.ccc..
................
................
................
"""],
    'heron': ["""
.....&&&........
....sss&&.......
.yyysZs.........
.....ss.........
......s.........
.....ss.........
.....sSS........
.....sSSSS......
......SSSSSM....
......SSSSSMM...
.......SSSMM&...
........SS......
........N.......
........N.......
........N.......
.......NN.......
""", """
................
................
................
.......SSSS.....
......sSSSSSM...
.....ssSSSSSMM..
....ss.SSSMM&...
...ss...SS......
..&sZ...N.......
..ss....N.......
..y.....N.......
..y.....N.......
..y....NN.......
................
cc.cc.c.cc......
................
"""],
    'blackWoodpecker': ["""
.NBB............
.NnB...EE.......
.NBB..EEE.......
.NnBii&Z&.......
.NBB..+&&&......
.NnB..+&&&&.....
.NBB..+&&&&.....
.NnB...+&&&.....
.NBB...+&&&.....
.NnB...&&&&.....
.NBB...&&&......
.NnB...&&&......
.NBB...&&.......
.NnB..&&........
.NBB.&&.........
.NnB............
""", """
.NBB............
.NnB....EE......
.NBB...EEE......
AN.Bii.&Z&......
.NBB...+&&&.....
.NnB..+&&&&.....
ANBB..+&&&&.....
.NnB...+&&&.....
.NBB...+&&&.....
.NnB...&&&&.....
.NBB...&&&......
.NnB...&&&......
.NBB...&&.......
.NnB..&&........
.NBB.&&.........
.NnB............
"""],
    'roeDeer': ["""
...N.N..........
...$$N..........
..$$$$..........
.Z$$$...........
&$$$............
..$$%...........
...$$$$$$$$$w...
...$$$$$$$$$ww..
...%$$$$$$$%w...
...%%$$$$$%%....
....%.%...%.%...
....%.%...%.%...
....%.%...%.%...
....N.N...N.N...
................
................
""", """
................
................
................
................
.....$$$$$$$$w..
....$$$$$$$$$ww.
...$$$$$$$$$%w..
..$$%$$$$$$%%...
.$$..%.%...%.%..
N$$..%.%...%.%..
&Z$..%.%...%.%..
.....%.%...%.%..
.....N.N...N.N..
...dd.d..d.d....
................
................
"""],
    'salamander': ["""
................
................
................
................
................
................
................
................
................
.&&.............
&yZ&&&.&...&....
&&&y&&&y&&y&&...
.&&&&y&&&&&&y&&.
..&...&...&...&&
.&...&...&......
................
""", """
................
................
................
................
................
................
................
................
.............&&.
.&&...........&.
&yZ&&&.&...&..&.
&&&y&&&y&&y&&&..
.&&&&y&&&&&&y...
..&...&...&.....
.&...&...&......
................
"""],
    'skylark': ["""
................
................
................
................
................
....~...........
...~*~..........
..~*~*~.........
.N*Z~~~~........
..'**~*~~~......
...'*~*~~*~~....
...''*~*~*~~~;..
....''~~~~~;;...
......N..N......
.....NN.NN......
................
""", """
................
.~~.......~~....
.*~~.....~~*....
..*~~...~~*.....
...*~~.~~*......
...N*~~~~*~.....
..N.*Z~~~*~~;...
....'*~*~~~;;;..
.....''~~~;.....
................
................
................
................
................
................
................
"""],
    'hoopoe': ["""
................
................
................
.....rr&........
....rrrr&.......
...rZrrr........
NN.rrrr.........
..N.rrrr........
....rrrr&w&w....
....rrr&w&w&w&..
.....rr&w&w&w&&.
......r"&w&&&...
......N..N......
.....NN.NN......
................
................
""", """
..&.&.&.&.......
..r.r.r.r.......
..rrrrrrr.......
...rrrrr........
....rrrr&.......
...rZrrr........
NN.rrrr.........
..N.rrrr........
....rrrr&w&w....
....rrr&w&w&w&..
.....rr&w&w&w&&.
......r"&w&&&...
......N..N......
.....NN.NN......
................
................
"""],
}
WILD_PAL = dict(PAL)
WILD_PAL.update({'r': (240, 160, 110), '"': (214, 120, 84)})


def little_owl(frame):
    g = Grid(16, 16)
    dy = 1 if frame else 0
    g.ball(8, 10.5 + dy, 5.0, 4.6, '*~;', ring='A')
    g.ball(8, 5.8 + dy, 4.4, 3.6, '*~;', ring='A')
    for (x, y) in ((5, 10), (8, 12), (11, 10), (6, 13), (10, 13), (4, 4), (12, 4), (8, 3)):
        g.set(x, y + dy, 'w')
    for ex in (6, 10):
        g.set(ex - 1, 6 + dy, 'w'); g.set(ex + 1, 6 + dy, 'w')
        g.set(ex, 6 + dy, 'y' if not frame else '~')
        g.set(ex, 5 + dy, 'w')
        if not frame:
            g.set(ex, 6 + dy, 'Z')
            g.set(ex - 1, 6 + dy, 'y')
            g.set(ex + 1, 6 + dy, 'y')
    g.set(8, 7 + dy, 'i')
    g.set(6, 15, 'y'); g.set(7, 15, 'y'); g.set(9, 15, 'y'); g.set(10, 15, 'y')
    return icon(g.rows())


def wild_section():
    for sid, frames in WILD.items():
        for k, rows in enumerate(frames):
            im = art(rows_of(rows), outline=1, w=16, h=16, pal=WILD_PAL)
            add(f'wild.{sid}' + ('.1' if k else ''), im)
    add('wild.littleOwl', little_owl(0))
    add('wild.littleOwl.1', little_owl(1))


def hint_pincer():
    g = Grid(16, 16)
    g.ball(8.5, 7.5, 6.4, 4.2, '[]V', ring='A')
    g.stamp(['.ws', 'wwsS', '.sSS'], 1, 11)
    g.stamp(['.ws', 'wws'], 11, 12)
    g.stamp(['ccccccccccc'], 2, 15)
    return icon(g.rows())


def hint_drum():
    g = Grid(16, 16)
    g.rect(4, 0, 11, 15, 'B')
    for y in range(16):
        for x in range(4, 12):
            if (x + y * 2) % 5 == 0:
                g.set(x, y, 'N')
        g.set(11, y, 'N')
    g.ball(8, 8, 1.6, 2.2, 'H', ring=None)
    for (x0, y0) in ((0, 4), (13, 4), (0, 11), (13, 11)):
        g.set(x0, y0, 'w'); g.set(x0 + 1, y0, 'w')
    g.stamp(['w.', '.w'], 0, 6)
    g.stamp(['.w', 'w.'], 14, 6)
    return icon(g.rows())


def hint_hoof():
    g = Grid(16, 16)
    for (ox, oy) in ((2, 1), (8, 8)):
        g.stamp(['.NN.NN.', 'NnN.NnN', 'NnN.NnN', 'NNN.NNN', '.NN.NN.', '..N.N..'], ox, oy)
    return icon(g.rows())


def hint_webbed():
    g = Grid(16, 16)
    for (ox, oy) in ((1, 1), (8, 8)):
        g.stamp(['N.N.N', 'NNNNN', '.NnN.', '.NNN.', '..N..', '..N..'], ox, oy)
    return icon(g.rows())


def hints_section():
    add('wild.hint.pincer', hint_pincer())
    add('wild.hint.drum', hint_drum())
    add('wild.hint.hoof', hint_hoof())
    add('wild.hint.webbed', hint_webbed())


# ===========================================================================
# 7. Cueillette, pêche, Reinette grise

def cep():
    g = Grid(16, 16)
    g.ball(3.5, 12.5, 1.6, 1.8, 'lk', ring='A')          # petit cèpe à côté
    g.ball(3.5, 10.2, 2.6, 1.6, 'nNH', ring='A', clip=lambda x, y: y <= 10)
    g.ball(9.5, 11.5, 3.6, 3.8, 'lkf', ring='A')          # pied ventru
    g.ball(9.5, 6.5, 6.0, 3.8, 'nNH', ring='A', clip=lambda x, y: y <= 7)
    for x in range(5, 15):
        if g.get(x, 8) != '.':
            g.set(x, 8, 'i')                               # pores jaunes
    g.set(7, 4, 'b'); g.set(8, 4, 'b')
    for (x, y) in ((8, 12), (10, 13)):
        g.set(x, y, 'f')
    return icon(g.rows())


def chanterelle():
    g = Grid(16, 16)
    for (cx, cy, s) in ((4.5, 8, 1.0), (11, 7, 1.1), (8, 11, 0.9)):
        top = int(cy - 2 * s)
        g.ball(cx, cy, 3.4 * s, 1.6 * s, 'iyY', ring='A')
        for y in range(int(cy + 1), int(cy + 5 * s)):
            w = max(0, int(1.6 * s - (y - cy) * 0.25))
            for x in range(int(cx - w), int(cx + w) + 1):
                g.set(x, y, 'y' if x <= cx else 'Y')
        g.set(int(cx) - 1, int(cy) - 1, 'w')
    return icon(g.rows())


def hedgehog_mushroom():
    g = Grid(16, 16)
    g.ball(8.0, 12.0, 2.6, 3.0, 'lk', ring='A')
    g.ball(8.0, 7.5, 6.4, 3.4, 'lkf', ring='A', clip=lambda x, y: y <= 9)
    for x in range(3, 14, 2):                              # bord bosselé, aiguillons dessous
        if g.get(x, 10) != '.':
            g.set(x, 10, 'f')
    g.set(5, 6, 'w'); g.set(6, 5, 'w')
    g.stamp(['.d.d', 'dGdG'], 1, 13)
    return icon(g.rows())


def fish_icon(rx, back, mid, belly, spots=(), fin='Y', eye='Z', ry=3.0):
    g = Grid(16, 16)
    cx, cy = 7.5, 8
    for (x, y) in ellipse(cx, cy, rx, ry):
        g.set(x, y, back if y < 7 else mid if y < 9 else belly)
    tx = int(cx + rx)
    g.stamp([fin + '.', fin + fin, fin + fin, fin + '.'], tx, 6)
    g.set(tx + 1, 5, fin); g.set(tx + 1, 10, fin)
    fy = int(round(cy - ry)) - 1
    g.set(int(cx), fy, fin); g.set(int(cx) + 1, fy, fin)     # nageoire dorsale
    g.set(int(cx - rx) + 1, 7, eye)
    g.set(int(cx - rx) + 3, 8, back)                          # ouïe
    for (x, y, c) in spots:
        g.set(x, y, c)
    return icon(g.rows())


def fish_section():
    add('fish.minnow', fish_icon(5.0, '4', '3', '1', spots=[(5, 8, '4'), (7, 8, '4'), (9, 8, '4')], fin='3', ry=2.1))
    add('fish.chub', fish_icon(6.2, 'M', 's', 'w', spots=[(5, 6, 'S'), (8, 6, 'S'), (11, 6, 'S'), (7, 8, 'W')],
                               fin='Y'))
    add('fish.browntrout', fish_icon(6.2, '~', 'i', 'k', spots=[(5, 6, '&'), (8, 5, '&'), (10, 7, 'E'), (7, 8, 'E'),
                                                                  (11, 6, '&'), (4, 8, 'E'), (9, 9, '&')], fin='o'))
    im = art(rows_of(WILD['crayfish'][0]), outline=1, w=16, h=16, pal=WILD_PAL)
    add('fish.crayfish', im)


def find_section():
    add('find.cep', cep())
    add('find.chanterelle', chanterelle())
    add('find.hedgehogMushroom', hedgehog_mushroom())


RUSSET = {'Ŕ': (222, 200, 150), 'ŕ': (186, 156, 108), 'Ř': (138, 108, 74), 'ř': (98, 76, 56)}
PAL.update(RUSSET)


def reinette_icon():
    """Reinette grise du Canada : grosse pomme aplatie gris-roux, rugueuse (liège), joue un peu verte."""
    g = Grid(16, 16)
    g.ball(8, 9.8, 6.0, 4.9, 'ŔŕŘř', ring='A', cuts=[0.9, 0.6, 0.05])
    rnd = random.Random(5)
    cells = [(x, y) for y in range(16) for x in range(16) if g.get(x, y) in 'ŔŕŘ']
    for (x, y) in rnd.sample(cells, len(cells) // 5):
        g.set(x, y, rnd.choice(('Ř', '$', 'Ŕ', '3')))
    g.set(7, 6, 'ř'); g.set(8, 6, 'ř')
    g.stamp(['..N', '.N.', 'N..'], 7, 2)
    g.stamp(['GG.', 'Gdd'], 9, 2)
    g.set(5, 8, 'w')
    return icon(g.rows())


def reinette_fruit():
    """Les mêmes pommes posées sur le pommier adulte : les pommes de tree.apple.summer.ripe, recolorées gris-roux."""
    ripe, plain = v1.V3S['tree.apple.summer.ripe'], v1.V3S['tree.apple.summer']
    out = img(16, 16)
    a, b, o = ripe.load(), plain.load(), out.load()
    cmap = {K['R']: RUSSET['ŕ'], K['r']: RUSSET['Ŕ'], K['q']: RUSSET['Ř'], K['p']: RUSSET['Ŕ'], K['E']: RUSSET['ŕ'],
            K['e']: RUSSET['Ŕ']}
    for y in range(16):
        for x in range(16):
            if a[x, y] != b[x, y] and a[x, y][3]:
                c = a[x, y][:3]
                o[x, y] = cmap.get(c, RUSSET['ŕ'] if c != OUT else OUT) + (255,)
    return out


def heirloom_section():
    add('heirloom.reinetteGrise.icon', reinette_icon())
    add('heirloom.reinetteGrise.fruit', reinette_fruit())


# ===========================================================================
# 8. Terres sauvages, clairières

def ground_tile(kind, variant):
    rnd = random.Random({'wood': 11, 'marsh': 22, 'grassland': 33}[kind] + variant * 7)
    im = Image.new('RGBA', (16, 16), (0, 0, 0, 255))
    px = im.load()

    def put(x, y, c):
        px[x % 16, y % 16] = C(c) + (255,)

    base = {'wood': 'U', 'marsh': (96, 104, 78), 'grassland': 'G'}[kind]
    for y in range(16):
        for x in range(16):
            put(x, y, base)
    if kind == 'wood':
        for _ in range(40):
            put(rnd.randrange(16), rnd.randrange(16), rnd.choice(('~', ';', 'V')))
        for _ in range(7 + variant * 2):                   # feuilles mortes
            x, y = rnd.randrange(16), rnd.randrange(16)
            c = rnd.choice(('Y', '$', 'o', 'y', '%'))
            put(x, y, c); put(x + 1, y, c); put(x, y + 1, ';')
        if variant:
            for k in range(5):                              # brindille
                put(3 + k, 11 - k // 2, 'N')
        for _ in range(3):
            x, y = rnd.randrange(16), rnd.randrange(16)
            put(x, y, '³'); put(x + 1, y, '³')
    elif kind == 'marsh':
        for _ in range(30):
            put(rnd.randrange(16), rnd.randrange(16), rnd.choice(((80, 88, 66), (112, 120, 88))))
        for (cx, cy) in ((4, 5), (11, 12)) if variant == 0 else ((10, 3), (3, 11)):
            for (x, y) in ellipse(cx, cy, 2.6, 1.3):
                put(x, y, 'C')
            put(cx - 1, cy, 'c')
        for _ in range(12):                                 # joncs ras
            x, y = rnd.randrange(16), rnd.randrange(16)
            put(x, y, 'J'); put(x, y - 1, 'J'); put(x + 1, y - 2, 'G')
    else:
        for _ in range(28 + variant * 8):                   # herbe haute claire
            x, y = rnd.randrange(16), rnd.randrange(16)
            put(x, y, 'j'); put(x, y - 1, 'j'); put(x + rnd.choice((-1, 1)), y - 2, 'j')
            put(x, y + 1, 'J')
        if variant:
            for _ in range(3):
                put(rnd.randrange(16), rnd.randrange(16), 'w')
    return im


def wood_sprout():
    g = Grid(16, 16)
    for (x, y, h) in ((3, 12, 4), (9, 9, 5), (12, 13, 3)):
        g.rect(x, y - h, x, y, 'N')
        g.stamp(['jj.', '.jD'], x - 1, y - h - 1)
        g.stamp(['.d', 'dd'], x, y - h + 1)
    g.stamp(['.UU..', 'U~~U.'], 1, 13)
    g.stamp(['.UU.', 'U~~U'], 7, 10)
    g.stamp(['.UU.', 'U~~U'], 10, 14)
    return icon(g.rows())


def wood_hazel():
    im = img(16, 16)
    im.alpha_composite(hazel(), (2, 4))
    return im


def wood_birch():
    g = Grid(16, 32)
    for y in range(9, 30):
        g.set(7, y, '¶'); g.set(8, y, 's')
    for y in (11, 15, 19, 22, 26):
        g.set(7 + (y % 2), y, 'A')
        g.set(7, y + 1, ']')
    g.line(8, 14, 11, 10, 's')
    g.line(7, 17, 4, 13, '¶')
    leaf_crown(g, [(4.5, 9, 3.4), (11, 8.5, 3.4), (8, 5, 4.0), (7.5, 11, 3.0), (5, 13.5, 2.4), (11.5, 12.5, 2.2)],
               'µ«D', ring='D')
    g.stamp(['.³³³.', '³³.³³'], 5, 29)
    return obj(g)


def marsh_puddle():
    g = Grid(16, 16)
    g.ball(8.5, 11.5, 6.6, 2.8, 'cCC', ring='A', light=(0.5, 0.6, 0.5))
    g.set(6, 10, 'w'); g.set(7, 10, 'c'); g.set(11, 12, 'c')
    for (x, top) in ((1, 5), (2, 7), (3, 4)):
        g.rect(x, top, x, 11, 'D' if x % 2 else '7')
    g.rect(3, 4, 3, 5, 'N')
    for (x, top) in ((13, 6), (14, 4)):
        g.rect(x, top, x, 9, 'D' if x % 2 else '7')
    return icon(g.rows())


def marsh_pool():
    g = Grid(32, 32)
    cells = {}
    for y in range(32):
        for x in range(32):
            a = math.atan2(y - 17, x - 16)
            r = 11.5 + 1.6 * math.sin(a * 3) + 1.0 * math.sin(a * 5 + 1)
            d = math.hypot(x + 0.5 - 16, (y + 0.5 - 17) * 1.15)
            if d <= r:
                cells[(x, y)] = 'É' if d < r * 0.5 else 'C' if d < r * 0.85 else 'c'
    g.layer(cells, ring=None)
    for (x, y) in cells:
        if cells[(x, y)] == 'c' and (x + y) % 3 == 0:
            g.set(x, y, 'n')                            # berge vaseuse
    for (x, y) in ((12, 14), (13, 14), (19, 20), (20, 20), (15, 23)):
        g.set(x, y, 'w')
    im = obj(g)
    for (x, y) in ((17, 12), (10, 19)):
        im.alpha_composite(lily(flower=x > 12), (x, y))
    for (x, y, s) in ((2, 6, 1), (22, 4, 2), (25, 18, 3), (3, 20, 4)):
        im.alpha_composite(reeds_clump(h=8, seed=s), (x, y))
    return im


def marsh_iris():
    g = Grid(16, 16)
    for (x, top) in ((4, 4), (7, 2), (10, 5), (12, 7)):
        g.line(x, 15, x + (1 if x > 8 else -1), top, 'D')
    for (cx, cy) in ((6, 4), (11, 6)):
        g.stamp(['.y.', 'yYy', 'yiy', '.Y.'], cx - 1, cy - 2)
    g.stamp(['.y', 'yY'], 2, 9)
    return icon(g.rows())


def tall_grass(variant):
    g = Grid(16, 16)
    rnd = random.Random(40 + variant)
    for k in range(9):
        x = 1 + k * 1.7
        top = rnd.randint(2, 7)
        lean = rnd.choice((-1, 0, 1))
        for y in range(top, 16):
            xx = int(x + (lean if y < top + 4 else 0))
            g.set(xx, y, 'j' if y < top + 4 else 'G' if y < 13 else 'J')
        if variant and k % 3 == 0:
            g.set(int(x + lean), top - 1, '®')               # épillets
    return icon(g.rows())


def daisies():
    g = Grid(16, 16)
    for (cx, cy) in ((4, 6), (10, 4), (12, 10), (6, 11)):
        g.rect(cx, cy + 2, cx, 15, 'D')
        g.stamp(['.w.', 'wyw', '.w.'], cx - 1, cy - 1)
    g.stamp(['G.G', '.GG'], 1, 13)
    return icon(g.rows())


def eglantine():
    g = Grid(16, 16)
    g.ball(8, 9.5, 6.5, 5.4, '«D7', ring='A')
    for (x, y) in ((5, 7), (10, 6), (12, 10), (6, 11), (9, 12), (3, 10)):
        g.set(x, y, 'Æ'); g.set(x + 1, y, 'Æ'); g.set(x, y + 1, 'Æ'); g.set(x + 1, y + 1, 'y')
    for (x, y) in ((8, 9), (11, 13)):
        g.set(x, y, 'q')
    return icon(g.rows())


def wild_sign():
    g = Grid(16, 16)
    g.rect(7, 6, 8, 15, 'B')
    g.rect(8, 6, 8, 15, 'N')
    g.ball(7.5, 4.5, 4.6, 3.6, 'jDd', ring='A')
    g.line(5, 6, 10, 3, 'J')
    g.stamp(['.j..j', 'jJ.jJ'], 4, 14)
    return icon(g.rows())


def wild_offer():
    g = Grid(16, 16)
    for a in range(0, 360, 20):
        if (a // 20) % 2 == 0:
            x = 8 + 6.6 * math.cos(math.radians(a))
            y = 8.5 + 6.0 * math.sin(math.radians(a))
            g.set(int(round(x)), int(round(y)), 'w')
    g.rect(8, 7, 8, 12, 'N')
    g.stamp(['jj.jj', '.jDj.', '..D..'], 6, 5)
    g.stamp(['.nn.', 'nNNn'], 6, 12)
    return art(g.rows(), outline=0, w=16, h=16)


def clearing(variant):
    base = TOWN.crop((7 * 16, 1 * 16, 8 * 16, 2 * 16)).convert('RGBA')
    im = base.copy()
    px = im.load()
    rnd = random.Random(70 + variant)
    shapes = [(8, 9, 5.2, 4.2), (7, 8, 6.0, 3.6), (9, 8, 4.4, 5.0)]
    cx, cy, rx, ry = shapes[variant]
    inside = set(ellipse(cx, cy, rx, ry))
    for (x, y) in inside:
        if 0 <= x < 16 and 0 <= y < 16:
            px[x, y] = PAL['G'] + (255,)
    for (x, y) in inside:                                     # liseré d'ombre sous les arbres
        for (dx, dy) in ((0, -1), (-1, 0), (1, 0), (0, 1)):
            q = (x + dx, y + dy)
            if q not in inside and 0 <= q[0] < 16 and 0 <= q[1] < 16:
                px[q] = OUT + (255,)
    for (x, y) in inside:
        if (x, y - 1) not in inside and 0 <= x < 16 and 0 <= y < 16:
            px[x, y] = PAL['J'] + (255,)                      # ombre portée en haut
    flowers = [p for p in inside if 0 < p[0] < 15 and 0 < p[1] < 15 and (p[0], p[1] - 1) in inside]
    for (x, y) in rnd.sample(flowers, min(len(flowers), 6)):
        px[x, y] = C(rnd.choice(('w', 'y', 'P', 'w', 'E'))) + (255,)
    for (x, y) in rnd.sample(flowers, min(len(flowers), 5)):
        if px[x, y][:3] == PAL['G']:
            px[x, y] = PAL['j'] + (255,)
    return im


def wildland_section():
    for kind in ('wood', 'marsh', 'grassland'):
        add(f'wildland.{kind}.ground', ground_tile(kind, 0))
        add(f'wildland.{kind}.ground.1', ground_tile(kind, 1))
    add('wildland.wood.sprout', wood_sprout())
    add('wildland.wood.hazel', wood_hazel())
    add('wildland.wood.birch', wood_birch())
    add('wildland.marsh.puddle', marsh_puddle())
    add('wildland.marsh.pool', marsh_pool())
    add('wildland.marsh.iris', marsh_iris())
    add('wildland.grassland.tall', tall_grass(0))
    add('wildland.grassland.tall.1', tall_grass(1))
    add('wildland.grassland.daisies', daisies())
    add('wildland.grassland.bush', eglantine())
    add('wildland.sign', wild_sign())
    add('wildland.offer', wild_offer())
    for v in range(3):
        add(f'forest.clearing.{v}', clearing(v))


# ===========================================================================
# 9. Pictogrammes

ICONS = {
    'icon.place.brook': """
................
................
................
................
..C.....C.....C.
.CcC...CcC...Cc.
CC.CC.CC.CC.CC..
....CC...CC.....
................
.......[[[[.....
.....[[W[[[]....
....[[[[[[]]]...
....[]]]]]]]]...
.....]]]]]]]....
................
................
""",
    'icon.place.poppies': """
................
................
....EEE.EEE.....
...EpEEEpEEE....
...EEEEEEEEE....
...EEE&&EEEq....
...qEE&&EEqq....
....qqEEEqq.....
......qqq.......
.......d........
....dd.d........
.....ddd..dd....
.......d.dd.....
.......dd.......
.......d........
................
""",
    'icon.works': """
................
.SSS........SS..
SssS.......SsS..
SsS.......Ss....
.S.N.....Ss.....
....N...SN......
.....N.SN.......
......SN........
.....SNN........
....SN..N.......
...SN....N......
..SN......N.....
.SN........N....
SN..........N...
N............N..
................
""",
}


def icon_combe():
    im = img(16, 16)
    for (x, y, h) in ((0, 4, 11), (7, 5, 10), (4, 2, 13)):
        im.alpha_composite(conifer(h), (x, 16 - h - 1))
    return im


def icon_millpond():
    g = Grid(16, 16)
    g.ball(8, 9.5, 7.2, 4.6, 'cCC', ring='A', light=(0.5, 0.6, 0.5))
    g.ball(7, 10, 4.0, 2.4, 'jD', ring='7')
    g.set(9, 9, 'C'); g.set(10, 9, 'C'); g.set(9, 10, 'C')
    g.stamp(['.w.', 'wyw', '.w.'], 4, 7)
    return icon(g.rows())


def icon_bocage():
    g = Grid(16, 16)
    g.rect(0, 9, 15, 15, 'b')
    for y in range(9, 16):
        for x in range(0, 16):
            if abs(x - (8 + (y - 9) * 0.4)) < 1 + (y - 9) * 0.5:
                g.set(x, y, 'k')
    for cx in (2.5, 7.5, 12.5):
        g.ball(cx, 5.5, 3.0, 3.4, '«D7', ring='A')
    g.set(7, 3, 'w'); g.set(3, 4, 'E')
    return icon(g.rows())


def icon_orchard():
    g = Grid(16, 16)
    g.ball(6.5, 9.5, 5.0, 4.6, 'pEq', ring='A')
    g.stamp(['.N', 'N.'], 6, 3)
    g.stamp(['dd', 'Gd'], 8, 3)
    g.set(4, 7, 'w')
    g.rect(11, 9, 15, 13, 'w')
    g.set(12, 11, 'S'); g.set(13, 11, 'S'); g.set(14, 11, 'S')
    g.line(10, 9, 11, 9, 'N')
    return icon(g.rows())


def icon_view():
    g = Grid(16, 16)
    g.ball(11.5, 5, 2.8, 2.8, 'iyY', ring='A')
    for y in range(7, 16):
        for x in range(16):
            if y >= 9 + 3 * math.cos((x - 5) / 4.0) and y < 16:
                g.set(x, y, 'G' if y < 12 else 'D')
    for x in range(16):
        for y in range(16):
            if g.get(x, y) == 'G' and g.get(x, y - 1) == '.':
                g.set(x, y, 'j')
    g.stamp(['N.N'], 4, 4)
    return icon(g.rows())


def icon_river():
    g = Grid(16, 16)
    g.line(1, 13, 12, 2, 'N')
    g.line(2, 13, 12, 3, 'B')
    g.set(13, 1, 'w')
    for y in range(3, 9):
        g.set(14, y, 's')
    g.set(14, 9, 'E'); g.set(14, 10, 'w')
    for x in range(0, 16):
        g.set(x, 14, 'C' if (x // 3) % 2 else 'c')
        g.set(x, 15, 'C')
    return icon(g.rows())


def icon_wild(kind):
    g = Grid(16, 16)
    if kind == 'wood':
        g.rect(7, 8, 8, 14, 'B')
        g.set(8, 8, 'N')
        g.ball(7.5, 5.5, 5.0, 4.4, '«D7', ring='A')
        g.stamp(['UUUUUU'], 5, 15)
    elif kind == 'marsh':
        g.ball(8, 12.5, 7.2, 2.8, 'cCC', ring='A', light=(0.5, 0.6, 0.5))
        for (x, top) in ((5, 2), (8, 4), (11, 3)):
            g.rect(x, top, x, 12, 'D')
        g.rect(5, 2, 5, 4, 'N'); g.rect(11, 3, 11, 5, 'N')
        g.set(9, 13, 'w')
    else:
        for (x, top) in ((3, 6), (5, 4), (7, 7), (9, 5), (11, 8)):
            g.line(x, 15, x + (1 if x > 7 else -1 if x < 7 else 0), top, 'j' if x % 4 == 1 else 'G')
        g.stamp(['.w.', 'wyw', '.w.'], 11, 2)
        g.rect(12, 5, 12, 9, 'D')
    return icon(g.rows())


ALBUM_WILD = """
................
................
...NNNNNNNNN....
...NkkkkkkkN....
...NkSSSkkkN....
...NkkkkkkkN....
...Nk&&k&&kN....
...Nk&+k&+kN....
...Nk&ck&ckN....
...Nkk&&&kkN....
...NkkkkkkkN....
...NkSSSSkkN....
...NNNNNNNNN....
....E...........
....E...........
................
"""


def album_places():
    g = Grid(16, 16)
    cx, cy, R = 7.5, 7.5, 6.2
    for a in range(0, 360, 6):
        g.set(int(round(cx + R * math.cos(math.radians(a)))), int(round(cy + R * math.sin(math.radians(a)))), 'N')
        g.set(int(round(cx + (R - 1) * math.cos(math.radians(a)))), int(round(cy + (R - 1) * math.sin(math.radians(a)))),
              'B')
    for k in range(6):
        a = math.radians(k * 60 + 15)
        g.line(int(round(cx)), int(round(cy)), int(round(cx + (R - 1) * math.cos(a))),
               int(round(cy + (R - 1) * math.sin(a))), 'b')
        g.set(int(round(cx + (R + 1) * math.cos(a))), int(round(cy + (R + 1) * math.sin(a))), 'B')
    g.rect(7, 7, 8, 8, 'N')
    g.stamp(['c.cc.c', 'cccccc'], 5, 14)
    return icon(g.rows())


def icons_section():
    for name, rows in ICONS.items():
        add(name, icon(rows))
    add('icon.place.combe', icon_combe())
    add('icon.place.millpond', icon_millpond())
    add('icon.place.bocage', icon_bocage())
    add('icon.place.oldOrchard', icon_orchard())
    add('icon.view', icon_view())
    add('icon.river', icon_river())
    for k in ('wood', 'marsh', 'grassland'):
        add(f'icon.wildland.{k}', icon_wild(k))
    add('album.page.valleyWild', icon(ALBUM_WILD))
    add('album.page.places', album_places())


# ===========================================================================
# 10. Vignettes des récits (48 × 32) et vallée des étapes 6 et 7 (96 × 48)

def vignette_bg(sky_top='c', sky_bot='v', horizon=14, ground='G'):
    g = Grid(48, 32)
    v2.sky(g, 48, sky_top, sky_bot, 0, horizon)
    g.rect(0, horizon + 1, 47, 31, ground)
    return g


def finish(g, stamps=()):
    im = art(g.rows(), outline=0, w=48, h=32)
    for (s, x, y) in stamps:
        im.alpha_composite(s, (x, y)) if x >= 0 and y >= 0 else im.paste(s, (x, y), s)
    return frame_border(im)


def story_hill():
    """Joseph et le fermier assis sur la colline ; la vallée grise en bas."""
    g = Grid(48, 32)
    v2.sky(g, 48, 'c', 'v', 0, 12)
    for y in range(9, 20):                                   # vallée grise au loin
        for x in range(48):
            if y >= 11 + 2 * math.sin(x / 6.0):
                g.set(x, y, ']' if (x + y) % 5 else 'V')
    for x in range(48):                                      # ruisseau sec (pointillé clair)
        y = 15 + int(2 * math.sin(x / 5.0))
        if x % 2:
            g.set(x, y, '[')
    for y in range(20, 32):                                  # la colline au premier plan
        for x in range(48):
            if y >= 20 + (x - 24) ** 2 / 120:
                g.set(x, y, 'G' if y > 22 else 'j')
    # deux silhouettes assises, de dos : Joseph (casquette verte, chemise à carreaux) et le fermier (chapeau de paille)
    g.stamp(['..JJJJ..', '.JJJJJJ.', 'dddddddd', '.WWWWW..', '.WWWWW..', 'qRRqRRqR', 'RqRRqRRq', 'RRqRRqRR',
             'qRRqRRqR', 'xxxxxxxx', 'xx....xx'], 12, 13)
    g.stamp(['...kk.....', '..kkkk....', 'bkkkkkkkkb', '..NNNN....', '..NNNN....', '.CCCCCC...', 'CCOCCOCC..',
             'CCOCCOCC..', 'CCOOOOCC..', 'xxxxxxxx..', 'xx....xx..'], 24, 13)
    for (x, y) in ((4, 26), (10, 29), (38, 27), (44, 30)):
        g.set(x, y, 'd')
    g.stamp(['.ww.', 'wwww'], 6, 3)
    g.stamp(['.www.', 'wwwww'], 34, 4)
    return finish(g)


def story_helene():
    """Hélène aux jumelles, en ciré, dans les herbes ; un oiseau au loin."""
    g = vignette_bg(horizon=18)
    for x in range(48):
        g.set(x, 18, 'D' if x % 3 else '7')
    im = art(g.rows(), outline=0, w=48, h=32)
    p = portrait_helene()
    im.alpha_composite(p, (12, 0))
    # bec et oiseau lointain
    setpx(im, [(38, 6), (39, 7), (40, 6), (41, 7), (42, 6)], OUT)
    for (x, y) in ((3, 28), (6, 30), (42, 29), (45, 27)):
        setpx(im, [(x, y), (x, y - 1)], 'd')
    return frame_border(im)


def story_brook():
    """La roue du moulin qui tourne, l'eau qui chante."""
    g = vignette_bg(horizon=10)
    for y in range(22, 32):
        g.rect(0, y, 47, y, 'C' if (y % 3) else 'c')
    for x in range(0, 48, 5):
        g.set(x, 23, 'w')
    g = g
    im = art(g.rows(), outline=0, w=48, h=32)
    m = mill(1, 0)
    big = m.resize((m.width, m.height), Image.NEAREST)
    im.alpha_composite(big, (8, -14))
    for (x, y) in ((6, 22), (8, 20), (22, 21), (24, 23)):
        setpx(im, [(x, y)], 'w')
    # farine qui vole
    setpx(im, [(36, 8), (40, 6), (38, 12), (44, 9)], 'w')
    return frame_border(im)


def story_combe():
    """Un chevreuil dans la futaie."""
    g = vignette_bg('g', 'g', horizon=6, ground='J')
    g.rect(0, 0, 47, 8, '«')
    im = art(g.rows(), outline=0, w=48, h=32)
    for (x, y) in ((-6, -8), (26, -10), (10, -12), (36, -4)):
        tb = tree_big(9, '«DD7¤', seed=x, moss=True)
        im.paste(tb, (x, y), tb)
    for k in range(3):
        for y in range(32):
            blend_px(im, int(6 + k * 15 + y * 0.4), y, (255, 240, 170), 0.2)
    deer = art(rows_of(WILD['roeDeer'][0]), outline=1, w=16, h=16, pal=WILD_PAL)
    im.alpha_composite(deer, (18, 15))
    return frame_border(im)


def story_poppies():
    """Orchidées et papillons dans la prairie haute."""
    g = vignette_bg(horizon=9)
    for x in range(0, 48, 2):
        for y in range(12, 32, 3):
            g.set(x + (y % 2), y, 'j')
    for (x, h) in ((6, 12), (15, 16), (26, 13), (37, 17), (43, 10)):
        g.rect(x, 31 - h, x, 31, 'D')
        for k in range(5):
            g.set(x - 1 + (k % 2) * 2, 31 - h + k * 2, 'P' if k % 2 else 'Q')
            g.set(x, 31 - h + k * 2, 'P')
    for (x, y) in ((10, 22), (20, 26), (31, 24), (40, 28)):
        g.set(x, y, 'E'); g.set(x + 1, y, 'E')
    im = art(g.rows(), outline=0, w=48, h=32)
    for (x, y, c1, c2) in ((18, 6, 'y', 'Y'), (30, 9, 'C', ':'), (9, 10, 'w', 's')):
        b = butterfly(c1, c2)
        im.alpha_composite(b.resize((10, 8), Image.NEAREST), (x, y))
    return frame_border(im)


def story_millpond():
    """Promeneurs autour de l'étang, nénuphars, hirondelles."""
    g = vignette_bg(horizon=8)
    for (x, y) in ellipse(24, 21, 19, 7):
        g.set(x, y, 'C')
    for (x, y) in ellipse(24, 21, 19, 7):
        if g.get(x, y - 1) != 'C':
            g.set(x, y, 'c')
    im = art(g.rows(), outline=0, w=48, h=32)
    for (x, y) in ((14, 19), (28, 22), (20, 24)):
        im.alpha_composite(lily(True), (x, y))
    for (x, shirt, small) in ((2, 'E', False), (40, 'C', False), (36, 'y', True)):
        v = Grid(5, 10)
        top = 1 if not small else 3
        v.rect(1, top, 3, top + 1, 'f')
        v.rect(1, top + 2, 3, top + 4, shirt)
        v.rect(1, top + 5, 3, 8, 'x')
        im.alpha_composite(obj(v), (x, 14 if not small else 15))
    for (x, y) in ((12, 3), (30, 5), (22, 2)):
        im.alpha_composite(swallow(), (x, y))
    return frame_border(im)


def story_bocage():
    """La chevêche dans le saule têtard, au bord du chemin creux."""
    g = vignette_bg(horizon=10)
    g.rect(0, 24, 47, 31, 'b')
    g.rect(0, 24, 47, 24, 'B')
    for x in range(48):
        g.set(x, 23, 'n')
    im = art(g.rows(), outline=0, w=48, h=32)
    im.alpha_composite(view_outline(hedge_strip(48, 9, 'flower', seed=3)), (0, 12))
    w = pollard_willow(seed=1).resize((28, 36), Image.NEAREST)
    im.paste(w, (10, -6), w)
    owl = little_owl(0)
    im.alpha_composite(owl, (16, 12))
    return frame_border(im)


def story_orchard():
    """Le verger étiqueté et des enfants."""
    g = vignette_bg(horizon=11)
    im = art(g.rows(), outline=0, w=48, h=32)
    for (x, y) in ((0, 4), (16, 2), (32, 5)):
        im.alpha_composite(apple_tree('tended', seed=x), (x, y))
        im.alpha_composite(label_post(), (x + 10, y + 12))
    for (x, shirt, cap) in ((6, 'y', 'E'), (24, 'C', None), (38, 'E', 'C')):
        v = Grid(5, 9)
        if cap:
            v.rect(1, 0, 3, 0, cap)
        v.rect(1, 1, 3, 2, 'f')
        v.rect(1, 3, 3, 5, shirt)
        v.rect(1, 6, 3, 7, 'x')
        im.alpha_composite(obj(v), (x, 21))
    return frame_border(im)


def valley_stage(n):
    """Étapes 6 et 7 : la vallée des vignettes 0 à 5, le ruisseau bleu revenu et la brume ; puis les bois, la prairie,
    l'étang, tout vert et vivant."""
    im = v1.valley_stage(5).copy()
    px = im.load()
    W, H = im.size
    # le ruisseau : plus large, bleu vif, reflets
    for y in range(18, H - 1):
        cx = 30 + 10 * math.sin((y - 18) / 7.0) - (y - 18) * 0.5
        w = 3 if y > 30 else 2
        for dx in range(-w, w + 1):
            x = int(cx + dx)
            if 0 < x < W - 1:
                px[x, y] = (PAL['c'] if (dx == -w + 1 and y % 3 == 0) else PAL['C'] if abs(dx) < w else PAL[':']) + (255,)
    if n == 7:
        # étang au pied du ruisseau, bois sombre sur la colline, prairie de coquelicots, moulin
        for (x, y) in ellipse(18, 40, 9, 3.6):
            if 0 < x < W - 1 and 0 < y < H - 1:
                px[x, y] = PAL['C'] + (255,)
        for (x, y) in ellipse(16, 39, 3, 1):
            px[x, y] = PAL['c'] + (255,)
        for x0 in range(4, 46, 5):
            for (x, y) in ellipse(x0, 20, 3.2, 2.8):
                if 0 < x < W - 1 and 0 < y < H - 1:
                    px[x, y] = (PAL['D'] if (x < x0 and y < 20) else PAL['7']) + (255,)
        rnd = random.Random(7)
        for _ in range(40):
            x, y = rnd.randint(58, 92), rnd.randint(40, 46)
            px[x, y] = PAL['E'] + (255,)
        for _ in range(14):
            x, y = rnd.randint(4, 44), rnd.randint(26, 46)
            if px[x, y][:3] not in (PAL['C'], PAL['c'], PAL[':']):
                px[x, y] = C(rnd.choice(('w', 'P', 'y'))) + (255,)
    # brume du matin sur le fond de la vallée
    for y in range(22, 27):
        for x in range(1, W - 1):
            a = 0.35 * (1 - abs(y - 24) / 3) * (0.7 + 0.3 * math.sin(x / 4.0))
            if a > 0:
                px[x, y] = lerp(px[x, y][:3], (250, 252, 255), a) + (255,)
    return frame_border(im)


def vignette_section():
    add('story.hill', story_hill())
    add('story.helene', story_helene())
    add('story.brook', story_brook())
    add('story.combe', story_combe())
    add('story.poppies', story_poppies())
    add('story.millpond', story_millpond())
    add('story.bocage', story_bocage())
    add('story.oldOrchard', story_orchard())
    add('valley.stage.6', valley_stage(6))
    add('valley.stage.7', valley_stage(7))


# ===========================================================================
# 11. Décors et succès

def heron_vane():
    g = Grid(16, 16)
    g.rect(7, 8, 8, 15, 'N')
    g.rect(4, 13, 11, 13, 'N')
    g.stamp(['..&&...', '.sss&..', 'yyZss..', '...ssSS', '....SSSS', '.....SS.'], 3, 1)
    g.line(10, 6, 14, 6, 'S')
    g.set(7, 7, 'y'); g.set(8, 7, 'y')
    return icon(g.rows())


def valley_bench_decor():
    g = Grid(16, 16)
    g.rect(1, 5, 14, 6, 'B'); g.rect(1, 5, 14, 5, 'b')
    g.rect(1, 9, 14, 10, 'b'); g.rect(1, 11, 14, 11, 'B')
    for x in (2, 13):
        g.rect(x, 7, x, 8, 'N'); g.rect(x, 12, x, 14, 'N')
    g.stamp(['.w.', 'wyw', '.d.'], 6, 12)
    return icon(g.rows())


def mill_wheel_decor():
    g = Grid(32, 32)
    cx, cy, R = 15.5, 15.5, 12.5
    for a in range(0, 360, 3):
        for rr, ch in ((R, 'N'), (R - 1, 'B'), (R - 2, 'B')):
            g.set(int(round(cx + rr * math.cos(math.radians(a)))), int(round(cy + rr * math.sin(math.radians(a)))), ch)
    for k in range(8):
        a = math.radians(k * 45 + 10)
        for t in range(2, int(R - 1)):
            g.set(int(round(cx + t * math.cos(a))), int(round(cy + t * math.sin(a))), 'b')
        for t in (R + 1, R + 2):
            g.set(int(round(cx + t * math.cos(a))), int(round(cy + t * math.sin(a))), 'B')
    g.ball(cx, cy, 2.4, 2.4, 'bBN', ring='A')
    for (x, y) in ((4, 29), (8, 30), (24, 30), (27, 29)):
        g.set(x, y, 'c')
    return icon(g.rows(), w=32, h=32)


ACH_MOTIF = {
    'firstWorks': ['S.....', 'SN....', '.SN.N.', '..NN..', '..NSN.', '.N..SN'],
    'waterBack': ['..C...', '.CcC..', 'CcccC.', 'CcwcC.', '.CCC..', '......'],
    'livingValley': ['C....C', 'cC..Cc', '.CccC.', '.dDDd.', 'dDDDDd', '.dddd.'],
    'sixPlaces': ['.N.N.N', 'NBNBNB', '.N.N.N', 'NBNBNB', '.N.N.N', '......'],
    'helenesBook': ['NNNNN.', 'NkkkN.', 'N&k&N.', 'N&k&N.', 'NkkkN.', 'NNNNN.'],
    'firstWild': ['..D...', '.DjD..', '.jDj..', '..N...', '..N...', '.nnn..'],
    'forestBack': ['.D..D.', 'DjDDjD', 'DDDDDD', '.7DD7.', '..NN..', '..NN..'],
    'riverAngler': ['....N.', '...N.s', '..N..s', '.N...E', 'CcCcCc', 'cCcCcC'],
}


def decor_section():
    add('decor.heron.vane', heron_vane())
    add('decor.valley.bench', valley_bench_decor())
    add('decor.mill.wheel', mill_wheel_decor())


def ach_section():
    for aid, motif in ACH_MOTIF.items():
        im = v2.ach_icon(motif)
        add(f'icon.ach.{aid}', im)
        add(f'icon.ach.{aid}.locked', gc.gray(im))


# ===========================================================================
# Assemblage

SECTIONS = [places_section, view_section, wild_section, hints_section, find_section, fish_section, heirloom_section,
            wildland_section, icons_section, vignette_section, decor_section, ach_section]


def pack():
    used = set()
    pos = {}
    items = list(ENTRIES)
    order = sorted(range(len(items)), key=lambda i: (-(items[i][1].height * items[i][1].width), i))
    for i in order:
        name, im = items[i]
        w, h = im.width // T, im.height // T
        r = 0
        while name not in pos:
            for c in range(SHEET_COLS - w + 1):
                cells = {(c + a, r + b) for a in range(w) for b in range(h)}
                if not cells & used:
                    used |= cells
                    pos[name] = (c, r, w, h)
                    break
            r += 1
    rows = max(r + h for (c, r, w, h) in pos.values())
    return items, pos, rows


def _num(v):
    return str(int(v)) if float(v).is_integer() else str(v)


def js_entry(sheet, c, r, w, h):
    return f"{{ sheet: '{sheet}', col: {_num(c)}, row: {_num(r)}" + \
        (f', w: {_num(w)}, h: {_num(h)}' if (w, h) != (1, 1) else '') + ' }'


HEADER = """// Lot V3 de La Vallée vivante (planches « valley3 », assets/sprites/valley3.png, et « valley3bg »,
// assets/sprites/valley3-bg.png) : « Le ruisseau », style Kenney.
// Vue de la vallée : fonds view.bg.<saison> (192 × 432, planche valley3bg, quatre saisons dessinées) ; lieux posés aux
// coordonnées du cadrage commun, dessinés en été (herbe Kenney recolorée par saison) : place.brook.0 … 4 (64 × 312 :
// h = 19,5 tuiles), place.mill.0 / .1 / .1.a (32 × 48), place.combe.0 … 3 (96 × 96), place.poppies.0 … 3,
// place.oldOrchard.0 … 3 (80 × 80), place.millpond.0 … 3 (80 × 64), place.bocage.0 … 3 (192 × 64, bande du ruisseau
// transparente), place.works (32 × 32), place.sprouts ; view.farm.1 … 4 (48 × 48), view.signpost (16 × 32),
// view.pontoon, view.bench (32 × 16), view.helene[.1], portrait.helene (32 × 32), fx.ripple[.1], fx.mist (32 × 16).
// Grands dessins de la vue : contour (64, 39, 50) au lieu de (63, 38, 49) (pas de neige automatique des planches
// d'hiver ; le givre est posé par le rendu). Habitants wild.<id>[.1] (regard vers la GAUCHE), wild.hint.<pincer|drum|
// hoof|webbed> ; find.cep / chanterelle / hedgehogMushroom ; fish.minnow / chub / browntrout / crayfish ;
// heirloom.reinetteGrise.icon / .fruit (à poser par-dessus tree.apple.*) ; terres sauvages wildland.<sorte>.ground[.1],
// wildland.wood.sprout / hazel / birch (16 × 32), wildland.marsh.puddle / pool (32 × 32) / iris,
// wildland.grassland.tall[.1] / daisies / bush, wildland.sign, wildland.offer ; forest.clearing.0 … 2 ;
// icon.place.<id>, icon.works / view / river, icon.wildland.<sorte> ; story.<hill|helene|brook|combe|poppies|millpond|
// bocage|oldOrchard> (48 × 32), valley.stage.6 / 7 (96 × 48) ; album.page.valleyWild / places ; decor.heron.vane,
// decor.valley.bench, decor.mill.wheel (32 × 32) ; icon.ach.<id>[.locked].
// Ajoutés à SPRITES ici même (Object.assign), après sa définition."""


def existing_names(src):
    """Noms de sprites déclarés ailleurs dans atlas.js (hors bloc valley3) : clés littérales et alias écrits en dur."""
    src = re.sub(r'// <valley3:auto>\n.*?// </valley3:auto>', '', src, flags=re.S)
    names = set(re.findall(r"^\s*'([\w.]+)':", src, re.M))
    names |= set(re.findall(r"SPRITES\['([\w.]+)'\]\s*=", src))
    return names


def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument('--contact', help='dossier où écrire des planches de contrôle ×6 et les aperçus de la vue')
    args = ap.parse_args()
    for fn in SECTIONS:
        fn()
    bg_section()
    items, pos, rows = pack()
    sheet = img(SHEET_COLS * T, rows * T)
    for name, im in items:
        c, r, w, h = pos[name]
        sheet.alpha_composite(im, (c * T, r * T))
    bgsheet = img(VIEW_W * 4, VIEW_H)
    for i, s in enumerate(SEASONS):
        bgsheet.alpha_composite(BACKGROUNDS[s], (i * VIEW_W, 0))
    atlas = ROOT / 'src' / 'render' / 'atlas.js'
    src = atlas.read_text()
    mine = [n for n, _ in ENTRIES] + [f'view.bg.{s}' for s in SEASONS]
    assert len(mine) == len(set(mine))
    clash = sorted(set(mine) & existing_names(src))
    if clash:
        raise SystemExit('noms déjà pris dans atlas.js : ' + ', '.join(clash))
    sheet.save(HERE / 'valley3.png', optimize=True)
    bgsheet.save(HERE / 'valley3-bg.png', optimize=True)
    lines = [HEADER, '// Généré par assets/sprites/generate-valley3.py — ne pas modifier à la main.', 'const valley3 = {']
    for i, s in enumerate(SEASONS):
        lines.append(f"  'view.bg.{s}': {js_entry(SHEET_BG, i * VIEW_W // T, 0, VIEW_W // T, VIEW_H / T)},")
    for name, _ in ENTRIES:
        c, r, w, h = pos[name]
        if name in REAL_H:
            h = REAL_H[name] / T
        lines.append(f"  '{name}': {js_entry(SHEET, c, r, w, h)},")
    lines.append('};')
    lines.append('Object.assign(SPRITES, valley3);')
    block = '\n'.join(lines)
    if "  valley3: 'assets/sprites/valley3.png'," not in src:   # planches déclarées dans SHEETS
        anchor = "  valley2: 'assets/sprites/valley2.png',\n"
        if anchor not in src:
            raise SystemExit('planche valley2 absente de SHEETS dans src/render/atlas.js')
        src = src.replace(anchor, anchor + "  valley3: 'assets/sprites/valley3.png',\n"
                          "  valley3bg: 'assets/sprites/valley3-bg.png',\n", 1)
    if '// <valley3:auto>' not in src:
        if '// </valley2:auto>\n' not in src:
            raise SystemExit('marqueurs // <valley3:auto> (ou // </valley2:auto>) absents de src/render/atlas.js')
        src = src.replace('// </valley2:auto>\n', '// </valley2:auto>\n\n// <valley3:auto>\n// </valley3:auto>\n', 1)
    new = re.sub(r'(// <valley3:auto>\n).*?(// </valley3:auto>)', lambda m: m.group(1) + block + '\n' + m.group(2),
                 src, flags=re.S)
    atlas.write_text(new)
    n = len(mine)
    print(f'écrit {HERE / "valley3.png"} ({SHEET_COLS} × {rows} tuiles) et {HERE / "valley3-bg.png"} '
          f'({VIEW_W * 4 // T} × {VIEW_H // T} tuiles) : {n} sprites')
    if args.contact:
        contact_sheets(Path(args.contact))


# ---------------------------------------------------------------------------
# Contrôle visuel

def season_tint(im, season):
    return recolor(im, dict(zip(GRASS, SEASON_GRASS[season])))


def compose_view(season, step, farm_n=2):
    """La vue complète (192 × 432) : fond de la saison + lieux à l'étape donnée (teintés comme par le rendu)."""
    out = BACKGROUNDS[season].copy()
    st = lambda pid: min(step, 4 if pid == 'brook' else 3)
    order = [('combe', f'place.combe.{st("combe")}'), ('oldOrchard', f'place.oldOrchard.{st("oldOrchard")}'),
             ('millpond', f'place.millpond.{st("millpond")}'), ('poppies', f'place.poppies.{st("poppies")}'),
             ('brook', f'place.brook.{st("brook")}'), ('mill', 'place.mill.1' if step else 'place.mill.0'),
             ('farm', f'view.farm.{farm_n}'), ('bocage', f'place.bocage.{st("bocage")}')]
    for pid, name in order:
        x, y, w, h = RECTS[pid]
        im = season_tint(get(name), season).crop((0, 0, w, h))
        out.alpha_composite(im, (x, y))
    return out


def group_of(name):
    if name.startswith(('place.', 'view.farm')):
        return 'places'
    if name.startswith(('wild.', 'fish.', 'find.')):
        return 'wildlife'
    if name.startswith(('wildland.', 'forest.')):
        return 'wildland'
    if name.startswith(('story.', 'valley.stage', 'portrait.')):
        return 'vignettes'
    return 'icons'


def contact_sheets(folder, scale=6):
    folder.mkdir(parents=True, exist_ok=True)
    V1 = Image.open(HERE / 'valley1.png').convert('RGBA')
    V1S = g2.atlas_sprites('valley1', V1)
    refs = {
        'places': [],
        'wildlife': [V1S['wild.robin'], V1S['wild.frog'], V1S['wild.hint.feather']],
        'wildland': [V1S['nature.oak.summer'], V1S['nature.reeds']],
        'vignettes': [V1S['story.box'], V1S['valley.stage.5'], v1.CAS['portrait.joseph']],
        'icons': [V1S['icon.ach.valleyBox'], V1S['icon.ach.valleyBox.locked'], V1S['album.page.heirlooms']],
    }
    groups = {k: [] for k in refs}
    for name, im in ENTRIES:
        groups[group_of(name)].append(im)
    for key, ims in groups.items():
        sc_ = 3 if key == 'places' else scale
        W = 2000
        x = y = rowh = 0
        placed = []
        for im in refs[key] + [None] + ims:
            if im is None:
                x, y, rowh = 0, y + rowh + 6, 0
                continue
            w, h = im.width * sc_ + 8, im.height * sc_ + 8
            if x + w > W:
                x, y, rowh = 0, y + rowh, 0
            placed.append((x, y, im))
            x += w
            rowh = max(rowh, h)
        out = Image.new('RGBA', (W, y + rowh), (132, 198, 105, 255) if key != 'places' else (60, 60, 70, 255))
        for (x, y, im) in placed:
            out.alpha_composite(im.resize((im.width * sc_, im.height * sc_), Image.NEAREST), (x + 4, y + 4))
        out.save(folder / f'valley3-art-contact-{key}.png')
    # aperçus de la vue complète, 412 px de large (×2 centré, bords prolongés), chaque saison, étapes 0 à 4
    for season in SEASONS:
        row = []
        for step in range(5):
            v = compose_view(season, step, farm_n=1 + min(step, 3)).resize((384, 864), Image.NEAREST)
            frame = Image.new('RGBA', (412, 864))
            frame.alpha_composite(v, (14, 0))
            for xx in range(14):
                frame.paste(v.crop((0, 0, 1, 864)), (xx, 0))
                frame.paste(v.crop((383, 0, 384, 864)), (412 - 14 + xx, 0))
            row.append(frame)
        out = Image.new('RGBA', (412 * 5 + 40, 864), (30, 30, 30, 255))
        for i, f in enumerate(row):
            out.alpha_composite(f, (i * 422, 0))
        out.save(folder / f'valley3-art-view-{season}.png')


if __name__ == '__main__':
    main()
