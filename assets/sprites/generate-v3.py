#!/usr/bin/env python3
"""Génère assets/sprites/v3.png : sprites du contenu « v3 » dessinés dans le style Kenney (CC0).

Tout est dessiné par programme, dans la palette exacte des packs Kenney Tiny Farm / Tiny Town
(contour sombre (63, 38, 49) de 2 px, 2 à 3 tons par matière, lumière venant d'en haut à gauche),
ou obtenu en recoloriant / assemblant des tuiles Kenney (clôture blanche, murs chaulés, fermier…).

Le script :
  1. dessine chaque sprite (dessins ASCII : une lettre = une couleur de la palette, « . » = vide ;
     le contour de 2 px est ajouté automatiquement autour de la silhouette) ;
  2. range les sprites dans la planche (placement automatique, déterministe, 16 tuiles de large) ;
  3. écrit assets/sprites/v3.png ;
  4. réécrit, dans src/render/atlas.js, le bloc compris entre les marqueurs
     « // <v3:auto> » et « // </v3:auto> » (entrées SPRITES de la planche « v3 »).

Relancer après modification :  python3 assets/sprites/generate-v3.py   (nécessite Pillow)
"""
from pathlib import Path
import math
import re
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
FARM = Image.open(HERE / 'tiny-farm.png').convert('RGBA')
TOWN = Image.open(HERE / 'tiny-town.png').convert('RGBA')
T = 16
SHEET_COLS = 16

# ---------------------------------------------------------------------------
# Palette (couleurs relevées dans les planches Kenney)
OUT = (63, 38, 49)
PAL = {
    'A': OUT,
    # verts
    'g': (198, 229, 141), 'G': (132, 198, 105), 'd': (78, 151, 76), 'D': (71, 159, 74),
    'j': (139, 216, 125), 'J': (101, 165, 86),
    # rouges / roses
    'r': (242, 132, 98), 'R': (195, 75, 53), 'q': (170, 44, 35), 'p': (255, 112, 109), 'e': (252, 188, 143),
    'E': (232, 69, 55),
    # jaunes / oranges
    'y': (253, 190, 83), 'Y': (227, 134, 40), 'o': (186, 102, 42), 'i': (255, 216, 150),
    # bois / terre / peau
    'k': (254, 201, 156), 'l': (253, 214, 180), 'b': (234, 165, 108), 'B': (207, 130, 84),
    'n': (189, 108, 74), 'N': (118, 59, 54), 'h': (223, 169, 136),
    'f': (247, 194, 130), 'F': (225, 154, 101),
    # gris / blancs / bleus
    'w': (255, 255, 255), 'W': (235, 239, 248), 's': (192, 203, 220), 'S': (139, 155, 180),
    'M': (90, 105, 136), 'x': (82, 96, 124), 'z': (62, 78, 110), 'Z': (38, 43, 68),
    'c': (153, 216, 248), 'C': (121, 167, 232), 'u': (0, 154, 220), 'v': (118, 228, 255),
    # violets
    'P': (209, 118, 208), 'Q': (155, 76, 163),
}

# ---------------------------------------------------------------------------
# Outils de dessin

def img(w=T, h=T):
    return Image.new('RGBA', (w, h))

def tile(col, row, sheet=FARM, w=1, h=1):
    return sheet.crop((col * T, row * T, (col + w) * T, (row + h) * T))

def lum(p):
    return 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]

def art(rows, outline=2, pal=None, w=None, h=None):
    """Dessin ASCII → image. Contour automatique (1er anneau 8-voisins, 2e anneau 4-voisins)."""
    pal = pal or PAL
    w = w or -(-max(len(r) for r in rows) // T) * T
    h = h or -(-len(rows) // T) * T
    im = img(w, h)
    px = im.load()
    filled = set()
    for y, line in enumerate(rows):
        for x, ch in enumerate(line):
            if ch in '. ':
                continue
            if x >= w or y >= h:
                raise ValueError(f'hors cadre {x},{y}')
            px[x, y] = pal[ch] + (255,)
            filled.add((x, y))
    if outline:
        ring = set()
        for (x, y) in filled:
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    q = (x + dx, y + dy)
                    if q not in filled and 0 <= q[0] < w and 0 <= q[1] < h:
                        ring.add(q)
        allp = filled | ring
        if outline >= 2:
            ring2 = set()
            for (x, y) in allp:
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    q = (x + dx, y + dy)
                    if q not in allp and 0 <= q[0] < w and 0 <= q[1] < h:
                        ring2.add(q)
            ring |= ring2
        for q in ring:
            px[q] = OUT + (255,)
    return im

def compose(items, w=T, h=T):
    """Assemble des « tampons » ASCII (du fond vers l'avant) en un dessin ASCII.

    items : (motif, x, y) ou (motif, x, y, False). Chaque tampon trace d'abord un liseré de contour
    (1 px, 8-voisins) sur ce qui est déjà dessiné sous lui — les feuilles qui se chevauchent sont
    ainsi séparées par une ligne sombre, comme dans les plantes Kenney — puis son remplissage.
    Renvoie les lignes ASCII (à passer à art(), qui ajoute le contour extérieur).
    """
    grid = [['.'] * w for _ in range(h)]
    for it in items:
        pat, x0, y0 = it[0], it[1], it[2]
        ring = it[3] if len(it) > 3 else True
        cells = [(x0 + x, y0 + y, ch) for y, line in enumerate(pat) for x, ch in enumerate(line) if ch not in '. ']
        if ring:
            own = {(x, y) for x, y, _ in cells}
            for x, y, _ in cells:
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        q = (x + dx, y + dy)
                        if q in own or not (0 <= q[0] < w and 0 <= q[1] < h):
                            continue
                        if grid[q[1]][q[0]] != '.':
                            grid[q[1]][q[0]] = 'A'
        for x, y, ch in cells:
            if 0 <= x < w and 0 <= y < h:
                grid[y][x] = '.' if ch == '_' else ch
    return [''.join(r) for r in grid]

def over(base, top, x=0, y=0):
    out = base.copy()
    out.alpha_composite(top, (x, y))
    return out

def recolor(im, mapping):
    im = im.copy()
    px = im.load()
    m = {tuple(k): tuple(v) for k, v in mapping.items()}
    for y in range(im.height):
        for x in range(im.width):
            p = px[x, y]
            if p[3] and p[:3] in m:
                px[x, y] = m[p[:3]] + (p[3],)
    return im

def recolor_region(im, mapping, box):
    x0, y0, x1, y1 = box
    im = im.copy()
    px = im.load()
    for y in range(y0, y1):
        for x in range(x0, x1):
            p = px[x, y]
            if p[3] and p[:3] in mapping:
                px[x, y] = mapping[p[:3]] + (p[3],)
    return im

def put(im, pixels):
    px = im.load()
    for (x, y), ch in pixels.items():
        px[x, y] = PAL[ch] + (255,)

def paint(im, rows, x0=0, y0=0):
    """Peint un petit dessin ASCII par-dessus (sans contour ; « . » = inchangé)."""
    px = im.load()
    for y, line in enumerate(rows):
        for x, ch in enumerate(line):
            if ch in '. ':
                continue
            if ch == '_':
                px[x0 + x, y0 + y] = (0, 0, 0, 0)
            else:
                px[x0 + x, y0 + y] = PAL[ch] + (255,)
    return im

def shift(im, dx, dy):
    out = img(im.width, im.height)
    out.alpha_composite(im, (dx, dy)) if dx >= 0 and dy >= 0 else out.paste(im, (dx, dy), im)
    return out

def flip(im):
    return im.transpose(Image.FLIP_LEFT_RIGHT)

# Fané : même correspondance que les tuiles « fanées » de Tiny Farm (verts et fruits → bruns)
DEAD_LIGHT, DEAD_MID, DEAD_DARK = PAL['k'], PAL['b'], PAL['n']

def wither(im):
    im = im.copy()
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            p = px[x, y]
            if p[3] == 0 or p[:3] == OUT:
                continue
            l = lum(p)
            px[x, y] = (DEAD_LIGHT if l > 185 else DEAD_MID if l > 125 else DEAD_DARK) + (255,)
    return im

# ---------------------------------------------------------------------------
# Registre : nom → image (ou composé)

ENTRIES = []   # (nom, image) dans l'ordre de placement
ALIASES = []   # (nom, nom_cible)
COMPOSITES = []  # (nom, w, h, [(sheet, col, row, dx, dy, w, h)] ; sheet 'v3' + nom de tuile possible)
_seen = set()

def add(name, im):
    assert name not in _seen, name
    assert im.width % T == 0 and im.height % T == 0, (name, im.size)
    _seen.add(name)
    ENTRIES.append((name, im))

def alias(name, target):
    assert name not in _seen, name
    _seen.add(name)
    ALIASES.append((name, target))

def composite(name, w, h, layers):
    assert name not in _seen, name
    _seen.add(name)
    COMPOSITES.append((name, w, h, layers))

# ===========================================================================
# 1. Cultures : citrouille, pomme de terre, fraise, courgette
#    Étapes 1..4 (l'étape 0 réutilise la tuile commune « graines semées » de la planche extra),
#    icône (récolte), fané, sachet de graines, grand sac, cagette.

def flip_rows(rows):
    return [r[::-1] for r in rows]

SPROUT_A = [  # deux cotylédons ronds (citrouille, courgette)
    '................', '................', '................', '................',
    '................', '................', '................',
    '....gG....Gg....',
    '....GGGddGGG....',
    '.....GdddGG.....',
    '.......dG.......',
]
SPROUT_B = [  # trois petites feuilles (pomme de terre, fraise)
    '................', '................', '................', '................',
    '................', '................',
    '.......gG.......',
    '....gG.GG.Gg....',
    '....GGddddGG....',
    '......dGGd......',
    '.......dG.......',
]

LS = ['.gG.', 'gGGd', '.dd.']
LM = ['.gG.', 'gGGd', 'GGdd', '.dd.']
LB = ['.gGG.', 'gGGGd', 'GGGdd', '.ddd.']
LX = ['.gGGG.', 'gGGGGd', 'GGGdGd', 'GGGddd', '.dddd.']
FLOWER_W = ['.w.', 'wyw', '.w.']
FLOWER_Y = ['.y.', 'yiY', '.Y.']
STEM = ['d', 'd']

PUMPKIN = {
    1: SPROUT_A,
    2: compose([(['d', 'd'], 7, 9), (LB, 3, 6), (LB, 8, 5), (LS, 6, 8)]),
    3: compose([(['dd', 'd.'], 6, 8), (LB, 2, 4), (LB, 9, 3), (LX, 0, 7), (LB, 10, 7),
                (FLOWER_Y, 7, 2), (['.jjJ.', 'jjJJd', '.JJd.'], 4, 10)]),
    4: compose([(LB, 2, 1), (LB, 9, 1), (LX, 0, 4), (LX, 10, 4),
                (['dN', '.n'], 8, 4),
                (['...yYYYnYYy..', '..yiyYyYYyYY.', '.yiyYYyYYyYYo', '.yyyYYyYYyYYo',
                  '.yyYYYyYYYYoo', '.YyYYoYYYoYoo', '..YoYYoYYoYo.', '...ooooooooo.'], 1, 6)]),
}

PUMPKIN_ICON = [
    '................',
    '................',
    '.......dN.......',
    '.......dN.gG....',
    '.....yYYnYYdd...',
    '...yiyYYyYYYY...',
    '..yiyYYyYYyYYo..',
    '..yyyYYyYYyYYo..',
    '..yyYYYyYYYYoo..',
    '..YyYYoYYYoYoo..',
    '...YoYYoYYoYo...',
    '....oooooooo....',
]

TUBER = ['.kb.', 'kbbB', 'bnBB', '.BB.']

POTATO = {
    1: SPROUT_B,
    2: compose([(STEM, 7, 9), (LS, 3, 7), (LS, 9, 7), (LM, 6, 5), (LS, 5, 9), (LS, 8, 9)]),
    3: compose([(LX, 1, 5), (LX, 9, 5), (LX, 5, 3), (LX, 5, 7), (FLOWER_W, 2, 3), (FLOWER_W, 11, 3)]),
    4: compose([(LX, 1, 2), (LX, 9, 2), (LX, 5, 0), (LX, 5, 5), (LB, 1, 6), (LB, 10, 6),
                (FLOWER_W, 2, 0), (FLOWER_W, 11, 0),
                (TUBER, 1, 10), (TUBER, 10, 10), (['.kb.', 'kbBB', '.BB.'], 6, 11)]),
}

POTATO_ICON = [
    '................', '................', '................',
    '......kkbb......',
    '....kkkbbbbb....',
    '...kkbbbnbbbB...',
    '...kbbbbbbbnB...',
    '...bnbbbbbbbB...',
    '...bbbbnbbbBB...',
    '....bbbbbbBB....',
    '.....BBBBBB.....',
]

BERRY = ['.dd.', 'rRRR', 'RiRq', '.Rq.']

STRAWBERRY = {
    1: SPROUT_B,
    2: compose([(STEM, 7, 10), (LS, 3, 7), (LS, 9, 7), (LS, 6, 6), (LS, 4, 9), (LS, 8, 9)]),
    3: compose([(LB, 1, 7), (LB, 10, 7), (LB, 5, 5), (LB, 5, 9), (FLOWER_W, 2, 4), (FLOWER_W, 11, 4)]),
    4: compose([(LB, 1, 4), (LB, 10, 4), (LB, 5, 2), (LB, 5, 6), (LB, 1, 8), (LB, 10, 8),
                (BERRY, 1, 10), (BERRY, 6, 11), (BERRY, 11, 10)]),
}

STRAWBERRY_ICON = [
    '................', '................',
    '.......dG.......',
    '.....GddGdG.....',
    '....rRdGdRRR....',
    '...rpRRRRRRRq...',
    '...riRRiRRiRq...',
    '...RRRRRRRRRq...',
    '....RiRRiRRq....',
    '....RRRRRiRq....',
    '.....RiRRRq.....',
    '......RRRq......',
    '.......qq.......',
]

COURGETTE = ['bgGGGGg.', 'bGdGdGdd', '.dddddd.']

ZUCCHINI = {
    1: SPROUT_A,
    2: compose([(STEM, 7, 9), (LB, 2, 5), (LB, 9, 5), (LM, 6, 7)]),
    3: compose([(['d', 'd', 'd'], 7, 9), (LX, 1, 3), (LX, 9, 3), (LB, 0, 7), (LB, 11, 7), (LX, 5, 6),
                (FLOWER_Y, 7, 2)]),
    4: compose([(LX, 1, 1), (LX, 9, 1), (LB, 0, 5), (LB, 11, 5), (LX, 5, 3),
                (FLOWER_Y, 7, 0),
                (['.bgGGg..', 'bbGdGdd.', '.dddddd.'], 8, 8),
                (['..gGGGGGGg..', '.bGdGdGdGdd.', 'bbdddddddd..'], 1, 10)]),
}

ZUCCHINI_ICON = [
    '................', '................',
    '............bB..',
    '..........dGdb..',
    '.........dGdGd..',
    '........dGdGdd..',
    '.......gdGdGd...',
    '......gdGdGd....',
    '.....GdGdGd.....',
    '....GdGdGd......',
    '...ydGdGd.......',
    '..yydddd........',
    '...ydd..........',
]

SEEDS_TILE = ('extra', 6, 1)  # étape 0 commune

def clear_label(t, x0, y0, x1, y1):
    """Efface l'emblème d'un sachet Kenney (garde contour, toile et fond d'étiquette)."""
    px = t.load()
    keep = {OUT, PAL['b'], PAL['l'], PAL['B'], (254, 201, 156)}
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if px[x, y][:3] not in keep:
                px[x, y] = PAL['l'] + (255,)

EMBLEMS = {  # petits dessins 4×4 (sans contour) posés sur l'étiquette
    'pumpkin': ['.dN.', 'yYYY', 'yYYo', '.oo.'],
    'potato': ['.kb.', 'kbbB', 'bnbB', '.BB.'],
    'strawberry': ['.dd.', 'RRRR', 'RiRq', '.Rq.'],
    'zucchini': ['...b', '..dG', '.dGd', 'yd..'],
}

def seedbag(emb):
    t = tile(10, 0).copy()
    clear_label(t, 5, 6, 10, 11)
    paint(t, emb, 6, 7)
    return t

def sack(emb):
    t = tile(9, 0).copy()
    clear_label(t, 5, 7, 10, 12)
    paint(t, emb, 6, 8)
    return t

def crate(icon_img, dy=-2):
    """Cagette Kenney remplie : le produit dépasse au-dessus, le rebord avant reste devant."""
    base = tile(4, 6).copy()
    out = base.copy()
    out.paste(icon_img, (0, dy), icon_img)
    return front_of_crate(out, base)


def front_of_crate(out, base):
    front = base.crop((0, 9, 16, 16))
    out.alpha_composite(front, (0, 9))
    return out

def crop_section():
    specs = {
        'pumpkin': (PUMPKIN, PUMPKIN_ICON),
        'potato': (POTATO, POTATO_ICON),
        'strawberry': (STRAWBERRY, STRAWBERRY_ICON),
        'zucchini': (ZUCCHINI, ZUCCHINI_ICON),
    }
    for cid, (stages, icon_rows) in specs.items():
        ims = {k: art(v) for k, v in stages.items()}
        for k in (1, 2, 3, 4):
            add(f'crop.{cid}.{k}', ims[k])
        icon = art(icon_rows)
        add(f'crop.{cid}.icon', icon)
        add(f'crop.{cid}.dead', wither(ims[4] if cid == 'pumpkin' else ims[3]))
        add(f'seedbag.{cid}', seedbag(EMBLEMS[cid]))
        add(f'sack.{cid}', sack(EMBLEMS[cid]))
        if cid == 'zucchini':
            heap = art(compose([(['.bgGGGGGGg.', 'bbGdGdGdGdd', '.dddddddddd'], 2, 2),
                                (['.bgGGGGGGg.', 'bbGdGdGdGdd', '.dddddddddd'], 3, 5)]))
            add(f'crate.{cid}', crate(heap, 0))
        else:
            add(f'crate.{cid}', crate(icon))


# ===========================================================================
# 2. Pommier (une parcelle, 16 × 16 : se dessine exactement comme une culture, au même endroit)
#    Houppier rond façon « tree.round » de Tiny Farm, tronc court ; l'hiver, branches nues
#    (la scène ajoute la neige sur la planche d'hiver si elle le souhaite).

CANOPY = [
    '................',
    '................',
    '.....11112......',
    '...1112222222...',
    '..11222222223...',
    '..12222222223...',
    '.1122222222233..',
    '.12222322222233.',
    '.12223222232233.',
    '.22222222322333.',
    '..222322223333..',
    '..33332222333...',
    '....333NN333....',
    '.......nN.......',
    '.......nN.......',
]
TRUNK_BASE = {(6, 14): 'n', (9, 14): 'N'}
CANOPY_COLORS = {
    'green': {'1': 'g', '2': 'G', '3': 'd'},
    'autumn': {'1': 'i', '2': 'y', '3': 'Y'},
    'blossom': {'1': 'g', '2': 'G', '3': 'd'},
}
APPLES_FEW = [(4, 5), (10, 8), (7, 10)]
APPLES_MANY = [(4, 5), (9, 4), (11, 7), (3, 8), (7, 7), (10, 10), (5, 10)]
BLOSSOMS = [(5, 3), (9, 4), (3, 6), (7, 6), (12, 7), (4, 9), (9, 9), (6, 11)]


def canopy(season_key, apples=(), blossoms=()):
    cmap = CANOPY_COLORS[season_key]
    rows = [''.join(cmap.get(ch, ch) for ch in line) for line in CANOPY]
    rows[14] = '......nnNN......'
    items = [(rows, 0, 0, False)]
    for (x, y) in blossoms:
        items.append((['wp', 'pe'] if (x + y) % 2 else ['we', 'ee'], x, y, False))
    for (x, y) in apples:
        items.append((['rR', 'Rq'], x, y, False))
    return art(compose(items))


WINTER_TREE = [
    '................',
    '................',
    '....n.....n.....',
    '....n..n..n..n..',
    '..n.nn.n.nn.n...',
    '...nn..nnn..n...',
    '.....n.nN..nn...',
    '..nn..nnN.n.....',
    '....n.nNNn......',
    '.....nnNN.......',
    '.......nN.......',
    '.......nN.......',
    '.......nN.......',
    '.......nN.......',
    '......nnNN......',
]

SAPLING = [
    '................', '................', '................', '................',
    '................',
    '.......gG.......',
    '.....gGGdG......',
    '.....GdGGGd.....',
    '......dnGdd.....',
    '.......nN.......',
    '.......nN.......',
    '.......nN.......',
    '.......nN.......',
    '.......nN.......',
    '......nnNN......',
]

YOUNG = [
    '................', '................',
    '.......gGG......',
    '.....ggGGGGd....',
    '....gGGGGGGdd...',
    '....GGGGdGGGd...',
    '....GGdGGGGdd...',
    '....dGGGGdGdd...',
    '.....ddGGGdd....',
    '......dddNd.....',
    '.......nN.......',
    '.......nN.......',
    '.......nN.......',
    '.......nN.......',
    '......nnNN......',
]

APPLE_ICON = [
    '................', '................',
    '........N.dG....',
    '........NdGd....',
    '....rRRRnRRR....',
    '...rpwRRRRRRq...',
    '...rpRRRRRRRq...',
    '...RRRRRRRRRq...',
    '...RRRRRRRRqq...',
    '....RRRRRRqq....',
    '.....qRqqqq.....',
]


def tree_section():
    add('tree.apple.sapling', art(SAPLING))
    add('tree.apple.young', art(YOUNG))
    add('tree.apple.spring', canopy('blossom', blossoms=BLOSSOMS))
    add('tree.apple.summer', canopy('green', apples=APPLES_FEW))
    add('tree.apple.summer.ripe', canopy('green', apples=APPLES_MANY))
    add('tree.apple.autumn', canopy('autumn'))
    add('tree.apple.autumn.ripe', canopy('autumn', apples=APPLES_MANY))
    add('tree.apple.winter', art(WINTER_TREE))
    add('tree.apple.dead', wither(canopy('green')))
    add('tree.apple.icon', art(APPLE_ICON))


# ===========================================================================
# 3. Chèvre (regarde vers la droite, même gabarit que le mouton et la vache de Tiny Farm)

GOAT = [
    '................',
    '........sS......',
    '.........sS.....',
    '.........Nbbbb..',
    '..........bZbbk.',
    '..........bbbkk.',
    '.k.......bbbbk..',
    '.bBkkkkkkbbbWW..',
    '..bbbbbbbbbbWW..',
    '..bbbbbbbbbbbW..',
    '..bbbbbbbbbbb...',
    '..BbbbbbbbbbB...',
    '..BBBBBBBBBBB...',
    '...b.b...b.b....',
    '...N.N...N.N....',
]


def goat_section():
    add('animal.goat', art(GOAT))




# ===========================================================================
# 4. Produits transformés

JAM = [
    '................', '................',
    '....RwRwRwRw....',
    '...RwRwRwRwRw...',
    '....yyyyyyyy....',
    '.....wsssss.....',
    '....wqRRRRRq....',
    '....wRkkkkRq....',
    '....wRkRrkRq....',
    '....sRkkkkRq....',
    '....sqRRRRqq....',
    '.....qqqqqq.....',
]

CHEESE = [
    '................', '................', '................',
    '..........ii....',
    '........iiiiy...',
    '......iiiiiiy...',
    '....iiiiiiiiyY..',
    '..iiiiiiiiiiyY..',
    '..yyyyyyyyyyyY..',
    '..yYyyyyyyYyyY..',
    '..yyyyyYyyyyyY..',
    '..yyYyyyyyyYYo..',
    '..YYYYYYYYYYo...',
]

BREAD = [
    '................', '................', '................', '................',
    '......BBBBBB....',
    '....BBkBBBkBB...',
    '...BkBBBkBBBkn..',
    '..BkBBBkBBBkBnn.',
    '..BBBBBBBBBBBnn.',
    '..bbbbbbbbbbbbn.',
    '...bbbbbbbbbbn..',
    '....nnnnnnnnn...',
]


def flour():
    t = tile(2, 6).copy()
    t = recolor(t, {PAL['k']: PAL['w'], PAL['b']: PAL['W'], PAL['B']: PAL['s']})
    paint(t, ['.y.y.', '.yYy.', '..Y..'], 5, 9)
    return t


JUICE = [
    '................',
    '.......bB.......',
    '.......BB.......',
    '.......sS.......',
    '.......wS.......',
    '......wyyY......',
    '.....wyyyyY.....',
    '.....wkkkkY.....',
    '.....wkRrkY.....',
    '.....wkqRkY.....',
    '.....wkkkkY.....',
    '.....yyyyyY.....',
    '......YYYY......',
]


def juice():
    return art(JUICE)


def goat_milk():
    t = tile(3, 10).copy()
    return recolor_region(t, {PAL['b']: PAL['G'], PAL['n']: PAL['d']}, (0, 0, 16, 7))


def product_section():
    add('product.jam', art(JAM))
    add('product.cheese', art(CHEESE))
    add('product.flour', flour())
    add('product.bread', art(BREAD))
    add('product.juice', juice())
    add('product.milk.goat', goat_milk())


# ===========================================================================
# 5. Icônes (succès, atouts, écu)

STAR = [
    '................', '................',
    '.......ii.......',
    '.......iy.......',
    '......iyyY......',
    '..iiiiiyyyyyyY..',
    '...iyyyyyyyyY...',
    '....iyyyyyyY....',
    '.....yyyyyY.....',
    '....yyyyyyyY....',
    '....yyY..YyY....',
    '...yY......YY...',
]

TROPHY = [
    '................', '................',
    '...1111111111...',
    '.1.1222222223.3.',
    '.1.1222222223.3.',
    '..112222222233..',
    '....12222223....',
    '.....122223.....',
    '......1223......',
    '.......23.......',
    '.......23.......',
    '.....NNnnnn.....',
    '....NNnnnnnn....',
]
METALS = {
    'gold': {'1': 'i', '2': 'y', '3': 'Y'},
    'silver': {'1': 'w', '2': 's', '3': 'S'},
    'bronze': {'1': 'b', '2': 'B', '3': 'n'},
}

MEDAL = [
    '................',
    '..cCC.....rRq...',
    '...cCC...rRq....',
    '....cCC.rRq.....',
    '.....cCrRq......',
    '......cRq.......',
    '.....iyyyY......',
    '....iyyyyyY.....',
    '...iyyiyyyyY....',
    '...iyiiiyyyY....',
    '...yyyiyyyyY....',
    '...yyyyyyyYY....',
    '....yYYYYYY.....',
    '.....YYYYY......',
]

COINS = [
    '................', '................', '................',
    '.........iiiiy..',
    '........yyyyyyY.',
    '........YYYYYYo.',
    '..iiiiy.yyyyyyY.',
    '.yyyyyyYYYYYYYo.',
    '.YYYYYYoyyyyyyY.',
    '.yyyyyyYYYYYYYo.',
    '.YYYYYYoyyyyyyY.',
    '.yyyyyyYYYYYYYo.',
    '.YYYYYYoYYYYYYo.',
]

BASKET = [
    '................',
    '.....nnnnnn.....',
    '....n......n....',
    '...n...rR...n...',
    '...n..rRRq..n...',
    '..bbbbRRqqbbbb..',
    '..BbBbBbBbBbBn..',
    '..bBbBbBbBbBbn..',
    '..BbBbBbBbBbBn..',
    '...bBbBbBbBbn...',
    '...BnBnBnBnBn...',
    '....nnnnnnnn....',
]

COMPOST = [
    '................', '................',
    '.......gG.......',
    '......gGd.......',
    '....N.dd.N......',
    '...NNNnNNNNN....',
    '..bNNnNNGNnNb...',
    '..bbbbbbbbbbbb..',
    '..BnBBBBBBBBnB..',
    '..bbbbbbbbbbbb..',
    '..BnBBBBBBBBnB..',
    '..bbbbbbbbbbbb..',
    '..nnnnnnnnnnnn..',
]

BEE = [
    '................', '................',
    '.....WW..WW.....',
    '....WccW.WccW...',
    '....WccW.Wcc....',
    '.....WW..WW.....',
    '....yZyZyyy.....',
    '...yZyZyZyZyZ...',
    '..iyZyZyZyZyZZ..',
    '..yyZyZyZyZyZ...',
    '...YZYZYZYZY....',
    '....YYYYYY......',
]

BARN_ICON = [
    '................',
    '......gGd.......',
    '....gGGGGGd.....',
    '..gGGGGGGGGGd...',
    '.GGGGGGGGGGGGd..',
    '..dddddddddddd..',
    '...rRRRkkRRRq...',
    '...rRRRNNRRRq...',
    '...rRWnnnnWRq...',
    '...rRnWnnWnRq...',
    '...rRnnWWnnRq...',
    '...rRnnWWnnRq...',
    '...rRnWnnWnRq...',
    '...qqWnnnnWqq...',
]

BOOK = [
    '................', '................',
    '....RRRRRRRR....',
    '...rRRRRRRRRq...',
    '...rRyyyyyyRq...',
    '...rRRRRRRRRq...',
    '...rRRRRRRRRq...',
    '...rRRRRRRRRq...',
    '...rRRRRRRRRq...',
    '...rRRRRRRRRq...',
    '...rWWWWWWWWq...',
    '...rsssssssss...',
    '....qqqqqqqq....',
]

CL = ['.gG.', 'gGGd', 'GGdd', '.dd.']
CLOVER = compose([(['d...', '.d..', '..d.', '..d.'], 9, 10, False),
                  (['GG', 'Gd'], 7, 6, False),
                  (CL, 6, 2), (CL, 3, 5), (CL, 9, 5), (CL, 6, 8)])


def sparkle(t, x, y):
    """Petite étincelle (4 branches) avec son liseré sombre, comme les icônes Kenney."""
    s = art(['.i.', 'iwi', '.i.'], outline=1, w=16, h=16)
    out = t.copy()
    out.alpha_composite(s.crop((0, 0, 5, 5)), (x - 1, y - 1))
    return out


def ecu():
    return recolor(tile(9, 7, TOWN), {PAL['y']: PAL['W'], PAL['Y']: PAL['S']})


def icon_section():
    add('icon.star', art(STAR))
    for m in ('bronze', 'silver', 'gold'):
        add(f'icon.trophy.{m}', art([''.join(METALS[m].get(c, c) for c in line) for line in TROPHY]))
    add('icon.medal', art(MEDAL))
    add('icon.ecu', ecu())
    bag = tile(3, 6).copy()
    paint(bag, ['.k..k.', 'k..k.k', '.k.k..'], 5, 5)
    add('perk.seeds', sparkle(bag, 12, 2))
    can = recolor(tile(0, 7), {PAL['s']: PAL['i'], PAL['S']: PAL['y'], PAL['x']: PAL['Y']})
    add('perk.wateringcan', sparkle(can, 13, 2))
    add('perk.coin', art(COINS))
    add('perk.basket', art(BASKET))
    add('perk.compost', art(COMPOST))
    add('perk.bee', art(BEE))
    add('perk.barn', art(BARN_ICON))
    add('perk.book', art(BOOK))
    add('perk.clover', art(CLOVER))


# ===========================================================================
# 7. Tenues du fermier (recoloriage du fermier Tiny Farm : chapeau et visage inchangés)

SHIRT, SHIRT_DARK = (242, 132, 98), (195, 75, 53)
OVERALL, BUTTON = (82, 96, 124), (140, 156, 181)
OUTFITS = [
    None,  # 0 : tenue d'origine (chemise rouge, salopette bleu marine)
    {'shirt': 'plaid', 'overall': ('n', 'N'), 'button': 'b'},   # 1 : chemise à carreaux rouges
    {'shirt': ('i', 'y'), 'overall': ('C', 'x'), 'button': 'y'},  # 2 : salopette bleu vif
    {'shirt': ('W', 's'), 'overall': ('G', 'd'), 'button': 'g'},  # 3 : tablier vert
]


def outfit(base, spec, y0):
    t = base.copy()
    if spec is None:
        return t
    px = t.load()
    for y in range(y0, 16):
        for x in range(16):
            p = px[x, y]
            if not p[3]:
                continue
            c = p[:3]
            if c in (SHIRT, SHIRT_DARK):
                if spec['shirt'] == 'plaid':
                    ch = 'Z' if (x % 3 == 0 or y % 3 == 0) and c == SHIRT else 'q' if c == SHIRT_DARK else 'R'
                    if (x % 3 == 0 and y % 3 == 0):
                        ch = 'q'
                else:
                    ch = spec['shirt'][0] if c == SHIRT else spec['shirt'][1]
                px[x, y] = PAL[ch] + (255,)
            elif c == OVERALL:
                px[x, y] = PAL[spec['overall'][0]] + (255,)
            elif c == BUTTON:
                px[x, y] = PAL[spec['button']] + (255,)
    # ombre de la salopette : dernière rangée avant les chaussures
    return t


def farmer_section():
    for i, spec in enumerate(OUTFITS):
        add(f'farmer.outfit.{i}', outfit(tile(1, 9), spec, 7))
        add(f'farmer.outfit.{i}.nohat', outfit(tile(0, 9), spec, 9))




# ===========================================================================
# 6. Décorations (cosmétiques)

class Grid:
    """Petit canevas de lettres pour les dessins construits par programme."""

    def __init__(self, w, h):
        self.w, self.h = w, h
        self.g = [['.'] * w for _ in range(h)]

    def set(self, x, y, ch):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.g[y][x] = ch

    def get(self, x, y):
        return self.g[y][x] if 0 <= x < self.w and 0 <= y < self.h else '.'

    def rect(self, x0, y0, x1, y1, ch):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.set(x, y, ch)

    def stamp(self, rows, x0, y0):
        for y, line in enumerate(rows):
            for x, ch in enumerate(line):
                if ch not in '. ':
                    self.set(x0 + x, y0 + y, '.' if ch == '_' else ch)

    def rows(self):
        return [''.join(r) for r in self.g]


# --- Chemin de pierres (dallage qui se répète dans les deux sens) ---------------------------
STONE_ROWS = [  # (y0, hauteur, [(x0, largeur)]) ; la dernière colonne / ligne de chaque pierre = joint
    (0, 5, [(0, 6), (6, 5), (11, 5)]),
    (5, 6, [(3, 6), (9, 4), (13, 6)]),
    (11, 5, [(1, 5), (6, 6), (12, 5)]),
]


def stone_letter(x, y):
    """Lettre du dallage au point (x, y) (motif de période 16)."""
    x %= 16
    y %= 16
    for (y0, h, stones) in STONE_ROWS:
        if y0 <= y < y0 + h:
            for (x0, w) in stones:
                lx = (x - x0) % 16
                if lx < w:
                    ly = y - y0
                    if lx == w - 1 or ly == h - 1:
                        return 'S'  # joint
                    corner = (lx in (0, w - 2)) and (ly in (0, h - 2))
                    if corner:
                        return 'S'
                    if ly == 0 and lx < w - 2:
                        return 'W'
                    if ly == h - 2:
                        return 'S' if lx % 2 else 's'
                    return 's'
    return 'S'


def stone_path(mask):
    t = img()
    px = t.load()
    for y in range(16):
        for x in range(16):
            if mask(x, y):
                ch = stone_letter(x, y)
                # bords du chemin : joint sombre qui borde l'herbe
                edge = any(not mask(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
                           if 0 <= x + dx < 16 and 0 <= y + dy < 16)
                px[x, y] = PAL['M' if edge else ch] + (255,)
    return t


PATH_MASKS = {
    '': lambda x, y: True,
    '.h': lambda x, y: 2 <= y <= 13,
    '.v': lambda x, y: 2 <= x <= 13,
    '.ne': lambda x, y: (2 <= x <= 13 and y <= 13) or (2 <= y <= 13 and x >= 2),
    '.nw': lambda x, y: (2 <= x <= 13 and y <= 13) or (2 <= y <= 13 and x <= 13),
    '.se': lambda x, y: (2 <= x <= 13 and y >= 2) or (2 <= y <= 13 and x >= 2),
    '.sw': lambda x, y: (2 <= x <= 13 and y >= 2) or (2 <= y <= 13 and x <= 13),
    '.single': lambda x, y: 2 <= x <= 13 and 2 <= y <= 13 and not ((x in (2, 13)) and (y in (2, 13))),
}


# --- Massifs de fleurs : jardinière en bois, terre, feuillage et 5 fleurs ------------------
FLOWER_COLORS = {
    'red': ('r', 'R', 'y'),
    'yellow': ('i', 'y', 'o'),
    'blue': ('c', 'C', 'y'),
    'pink': ('e', 'P', 'y'),
    'white': ('w', 'W', 'y'),
}


def flowerbed(color):
    light, mid, heart = FLOWER_COLORS[color]
    fl = ['.' + light + '.', light + heart + mid, '.' + mid + '.']
    items = [
        (['..gG..gG.gG.', '.gGGdgGGdGGd', 'gGGdGGGdGGdd', 'GGdGdGGdGdGd'], 2, 5, False),
        (fl, 2, 3), (fl, 6, 2), (fl, 10, 3), (fl, 4, 6), (fl, 9, 6),
        (['bbbbbbbbbbbb', 'bBBBBBBBBBBn', 'BnBBBBBBBBnn', 'nnnnnnnnnnnn'], 2, 9),
    ]
    return art(compose(items))


BENCH = [
    '................', '................', '................',
    '..bbbbbbbbbbbb..',
    '..BBBBBBBBBBBn..',
    '..n.n......n.n..',
    '..bbbbbbbbbbbb..',
    '..BBBBBBBBBBBn..',
    '.kbbbbbbbbbbbbn.',
    '.nnnnnnnnnnnnnn.',
    '..nn........nn..',
    '..nN........nN..',
    '..nN........nN..',
]

LAMPPOST = [
    '................',
    '.......xx.......',
    '.....xxxxxx.....',
    '....xMMMMMMx....',
    '.....MiiyyM.....',
    '.....MiwyYM.....',
    '.....MiyyYM.....',
    '.....MiyyYM.....',
    '....xMMMMMMx....',
    '......xMMx......',
    '.......xM.......',
    '.......xM.......',
    '.......xM.......',
    '.......xM.......',
    '.......xM.......',
    '.......xM.......',
    '.......xM.......',
    '.......xM.......',
    '.......xM.......',
    '.......xM.......',
    '.......xM.......',
    '.......xM.......',
    '.......xM.......',
    '.......xM.......',
    '.......xM.......',
    '......xxMM......',
    '......xxMM......',
    '.....xxxMMM.....',
    '.....MMMMMM.....',
]

SCARECROW = [
    '................',
    '................',
    '.......yY.......',
    '......yyyY......',
    '......yyyY......',
    '...iyyyyyyyYY...',
    '....YYYYYYYY....',
    '......kbbB......',
    '......kZbZ......',
    '......kbbB......',
    '......bNNB......',
    '.......bB.......',
    '.yRRRRRqRRRRRRy.',
    'yyrRqRRRRRqRRqyy',
    '.y.RRRqRRRRRR.y.',
    '....RRRyyRRR....',
    '....RqRRRRqR....',
    '....RRRRRRRR....',
    '....xCCxCCCx....',
    '....xCCxxCCx....',
    '....xCx..CCx....',
    '....yy....yy....',
    '.......nN.......',
    '.......nN.......',
    '.......nN.......',
    '.......nN.......',
    '.......nN.......',
    '.......nN.......',
    '.......nN.......',
    '......nnNN......',
]

WHEELBARROW = [
    '................', '................', '................',
    '...........kbb..',
    '...RRRRRRRRRkb..',
    '..rrrrrrrrrrRR..',
    '..rRRRRRRRRRRq..',
    '...RRRRRRRRRq...',
    '....qqqqqqqq....',
    '.nn..n...Zx.....',
    'nn...n..ZxxM....',
    '.....n..xMMM....',
    '.........MM.....',
]

POND = [
    '................................',
    '................................',
    '................................',
    '.........sssssssssssss..........',
    '......sssWssccccccccsssss.......',
    '.....sWsccccccccccccccccss......',
    '....sWccccCCCCCCCCCCCccccss.....',
    '...sWcccCCCCCCCCCCCCCCCCccss....',
    '...sccCCCCCCCCCCCCCCCCCCCccs....',
    '..sWcCCCCCCCCCCCCCCCCCCCCCcSs...',
    '..sccCCCCCCCCCgGGCCCCCCCCCCSs...',
    '..scCCCCCCCCCgGGGdCCCCCCCCCSs...',
    '.sWcCCCCCCCCCGGpGdCCCCCCCCCCSs..',
    '.sccCCCwCCCCCGpePdCCCCCCCCCCSs..',
    '.scCCCCCCCCCCdGPdCCCCCCCCCCCSs..',
    '.scCCCCCCCCCCCdddCCCCCCCCCCCSs..',
    '.scCCCCCCCCCCCCCCCCCCgGGCCCCSs..',
    '.scCCCCCCCCCCCCCCCCCgGGGdCCCSs..',
    '.scCCCCCCCCCCCCCCCCCGGGGdCCCSs..',
    '.sSCCCCCCCwwCCCCCCCCdGGddCCSSs..',
    '..sSCCCCCCCCCCCCCCCCCdddCCCSs...',
    '..sSCCCCCCCCCCCCCCCCCCCCCCCSs...',
    '..sSSCCCCCCCCCCCCCCCCCCCCCSSs...',
    '...sSSCCCCCCCCCCCCCCCCCCCSSs....',
    '....sSSSCCCCCCCCCCCCCCCSSSs.....',
    '.....sSSSSSCCCCCCCCCSSSSSs......',
    '.......ssSSSSSSSSSSSSSss........',
    '.........sssssssssssss..........',
]

BIRDHOUSE = [
    '................',
    '................',
    '.......rR.......',
    '......rRRR......',
    '.....rRRRRq.....',
    '....rRRRRRRq....',
    '...rRRRRRRRRq...',
    '..qqqqqqqqqqqq..',
    '....bbbbbbBn....',
    '....bbbNNbBn....',
    '....bbNNNNBn....',
    '....bbbNNbBn....',
    '....bbbbbbBn....',
    '...nbnnnnnnnn...',
    '....nnnnnnnn....',
    '.......nN.......',
    '.......nN.......',
    '.......nN.......',
    '.......nN.......',
    '.......nN.......',
    '.......nN.......',
    '.......nN.......',
    '.......nN.......',
    '.......nN.......',
    '.......nN.......',
    '.......nN.......',
    '.......nN.......',
    '......nnNN......',
]

GNOME = [
    '................',
    '........rR......',
    '.......rRR......',
    '......rRRRq.....',
    '.....rRRRRq.....',
    '....rRRRRRRq....',
    '.....fffFFF.....',
    '.....fZffZF.....',
    '....WwwffwwW....',
    '....wWWWWWWs....',
    '...xCwWWWWsCx...',
    '...fCCwWWsCCf...',
    '....CCCyyCCx....',
    '....xxx..xxx....',
    '...NNN....NNN...',
]

MAILBOX = [
    '................',
    '..........y.....',
    '....rRRRRRyY....',
    '...rRRRRRRyY....',
    '...rRRRRRRRq....',
    '...ZrRRRRRRq....',
    '...ZrRRRRRRq....',
    '...ZqqqqqqqqA...',
    '.......nN.......',
    '.......nN.......',
    '.......nN.......',
    '.......nN.......',
    '.......nN.......',
    '......nnNN......',
]


def hedge(n, e, s, w):
    """Haie de buissons ronds raccordable : n/e/s/w = continue vers ce côté.

    Les touffes sont des disques espacés de 8 px (le motif se raccorde d'une tuile à l'autre),
    ombrés comme le buisson de Tiny Town (clair en haut à gauche, sombre en bas à droite).
    """
    R = 5.6
    if e or w:
        cs = [(x, 7.5) for x in (-4, 4, 12, 20)]
        cs = [(x, y) for (x, y) in cs if (w or x >= 4) and (e or x <= 12)]
        if not w:
            cs = [(7 if x == 4 else x, y) for (x, y) in cs]
        if not e:
            cs = [(9 if x == 12 else x, y) for (x, y) in cs]
        band = (min(x for x, _ in cs), max(x for x, _ in cs), 7, 13)
    elif n or s:
        cs = [(7.5, y) for y in (-4, 4, 12, 20)]
        cs = [(x, y) for (x, y) in cs if (n or y >= 4) and (s or y <= 12)]
        if not n:
            cs = [(x, 7 if y == 4 else y) for (x, y) in cs]
        if not s:
            cs = [(x, 8 if y == 12 else y) for (x, y) in cs]
        band = (3, 12, max(0, min(y for _, y in cs)), min(15, max(y for _, y in cs)))
    else:
        cs = [(7.5, 7.5)]
        band = None
    g = Grid(16, 16)
    for y in range(16):
        for x in range(16):
            px_, py_ = x + 0.5, y + 0.5
            best = None
            for (cx, cy) in cs:
                d = math.hypot(px_ - cx - 0.5, py_ - cy - 0.5)
                if d <= R and (best is None or d < best[0]):
                    best = (d, cx, cy)
            if best is None:
                if band and band[0] <= x <= band[1] and band[2] <= y <= band[3]:
                    g.set(x, y, 'D' if (e or w or x >= 9) else 'G')
                continue
            d, cx, cy = best
            dx, dy = px_ - cx - 0.5, py_ - cy - 0.5
            if dy > 1.5 or dx + dy > 4.5:
                ch = 'D'
            elif dx + dy < -5 and d > 3:
                ch = 'g'
            else:
                ch = 'G'
            g.set(x, y, ch)
    # quelques feuilles sombres dans le vert (comme les taches du buisson Kenney)
    for (x, y) in ((5, 6), (6, 6), (13, 5), (2, 9), (10, 9)):
        if g.get(x, y) == 'G':
            g.set(x, y, 'D')
    return art(g.rows())


def wall_piece(n, e, s, w, gate=False):
    """Muret de pierres sèches, raccordable comme les clôtures Kenney."""
    g = Grid(16, 16)
    hy0, hy1 = 5, 12     # bande horizontale
    vx0, vx1 = 4, 11     # bande verticale
    if e or w:
        g.rect(0 if w else vx0, hy0, 15 if e else vx1, hy1, 'x')
    if n or s:
        g.rect(vx0, 0 if n else hy0, vx1, 15 if s else hy1, 'x')
    if not (n or s or e or w):
        g.rect(vx0, hy0, vx1, hy1, 'x')
    if gate:
        g.rect(5, hy0 - 1, 10, hy1 + 1, '.')
    for y in range(16):
        for x in range(16):
            if g.get(x, y) != 'x':
                continue
            # pierres en quinconce (période 16 horizontalement, 4 verticalement)
            row = y // 4
            off = 0 if row % 2 == 0 else 3
            lx = (x + off) % 6
            ly = y % 4
            if lx == 5 or ly == 3:
                ch = 'M'
            elif ly == 0 or lx == 0:
                ch = 'W'
            elif ly == 2 or lx == 4:
                ch = 'S'
            else:
                ch = 's'
            # dessus du muret plus clair (chaperon) quand rien n'est au-dessus
            if g.get(x, y - 1) == '.' and ch != 'M':
                ch = 'W'
            g.set(x, y, ch)
    return art(g.rows())


def farm_sign():
    rows = [
        '................................',
        '..bbbbbbbbbbbbbbbbbbbbbbbbbbbb..',
        '.bkkkkkkkkkkkkkkkkkkkkkkkkkkkkn.',
        '.bklllllllllllllllllllllllllkBn.',
        '.bklllllllllllllllllllllllllkBn.',
        '.bklllllllllllllllllllllllllkBn.',
        '.bklllllllllllllllllllllllllkBn.',
        '.bklllllllllllllllllllllllllkBn.',
        '.bklllllllllllllllllllllllllkBn.',
        '.bkBBBBBBBBBBBBBBBBBBBBBBBBBBBn.',
        '..nnnnnnnnnnnnnnnnnnnnnnnnnnnn..',
        '.....nN................nN.......',
        '.....nN................nN.......',
        '.....nN................nN.......',
        '....nnNN..............nnNN......',
    ]
    return art(rows)


# Zone laissée libre sur le panneau de la ferme (pixels du sprite 32 × 16) : le nom s'y écrit par code
FARM_SIGN_TEXT_RECT = {'x': 3, 'y': 3, 'w': 26, 'h': 6}


def deco_slot():
    """Emplacement de décoration vide : carré pointillé et petit « + », crème semi-transparent."""
    t = img()
    px = t.load()
    c = (255, 241, 210, 200)
    for i in range(3, 13):
        if i % 2 == 1:
            for (x, y) in ((i, 2), (i, 13), (2, i), (13, i)):
                px[x, y] = c
    for (x, y) in ((2, 3), (3, 2), (12, 2), (13, 3), (2, 12), (3, 13), (12, 13), (13, 12)):
        px[x, y] = c
    for d in range(-2, 3):
        px[7 + d if d <= 0 else 7 + d, 7] = c
    for (x, y) in ((6, 7), (7, 7), (8, 7), (9, 7), (7, 6), (8, 6), (7, 8), (8, 8), (7, 5), (8, 5), (7, 9), (8, 9),
                   (5, 7), (5, 8), (6, 8), (9, 8), (10, 7), (10, 8)):
        px[x, y] = c
    return t


def deco_section():
    for suffix, mask in PATH_MASKS.items():
        add('deco.path.stone' + suffix, stone_path(mask))
    for c in FLOWER_COLORS:
        add(f'deco.flowerbed.{c}', flowerbed(c))
    add('deco.bench', art(BENCH))
    add('deco.lamppost', art(LAMPPOST, h=32))
    add('deco.scarecrow', art(SCARECROW, h=32))
    add('deco.wheelbarrow', art(WHEELBARROW))
    add('deco.pond', art(POND, w=32, h=32))
    add('deco.birdhouse', art(BIRDHOUSE, h=32))
    add('deco.gnome', art(GNOME))
    add('deco.mailbox', art(MAILBOX))
    add('deco.sign.farm', farm_sign())
    add('deco.slot', deco_slot())
    # Haie : pièce isolée, horizontale (gauche / milieu / droite), verticale (haut / milieu / bas)
    add('deco.hedge', hedge(False, False, False, False))
    add('deco.hedge.h.left', hedge(False, True, False, False))
    add('deco.hedge.h.mid', hedge(False, True, False, True))
    add('deco.hedge.h.right', hedge(False, False, False, True))
    add('deco.hedge.v.top', hedge(False, False, True, False))
    add('deco.hedge.v.mid', hedge(True, False, True, False))
    add('deco.hedge.v.bottom', hedge(True, False, False, False))
    # Clôture blanche : les pièces de la clôture Tiny Town, repeintes en blanc
    white = {PAL['b']: PAL['w'], PAL['n']: PAL['s'], PAL['N']: PAL['S']}
    fence_tiles = {
        'tl': (8, 3), 't': (9, 3), 'tr': (10, 3), 'l': (8, 4), 'r': (10, 4),
        'bl': (8, 5), 'gate': (9, 5), 'br': (10, 5),
        'v.top': (11, 3), 'v.mid': (11, 4), 'v.bottom': (11, 5),
        'h.left': (8, 6), 'h.mid': (9, 6), 'h.right': (10, 6),
    }
    for k, (c, r) in fence_tiles.items():
        add(f'deco.fence.picket.{k}', recolor(tile(c, r, TOWN), white))
    # Muret de pierres : mêmes pièces que les clôtures (+ « b » bas plein, « single » pilier isolé)
    walls = {
        'tl': (False, True, True, False), 't': (False, True, False, True), 'tr': (False, False, True, True),
        'l': (True, False, True, False), 'r': (True, False, True, False),
        'bl': (True, True, False, False), 'b': (False, True, False, True), 'br': (True, False, False, True),
        'v.top': (False, False, True, False), 'v.mid': (True, False, True, False), 'v.bottom': (True, False, False, False),
        'h.left': (False, True, False, False), 'h.mid': (False, True, False, True), 'h.right': (False, False, False, True),
        'single': (False, False, False, False),
    }
    for k, nesw in walls.items():
        add(f'deco.wall.stone.{k}', wall_piece(*nesw))
    add('deco.wall.stone.gate', wall_piece(False, True, False, True, gate=True))




# ===========================================================================
# 5 bis. Bâtiments : confiturerie, fromagerie (tuiles Tiny Town + pièces dessinées), moulin, fournil

# Murs chaulés : murs de pierre Tiny Town éclaircis (les portes et vitres restent d'origine)
WHITEWASH = {PAL['S']: PAL['W'], PAL['s']: PAL['w'], PAL['M']: PAL['s']}
# Bas des toits d'ardoise / pignon : la bordure de bois devient blanche, comme le mur dessous
WOOD_TO_WHITE = {PAL['b']: PAL['w'], PAL['n']: PAL['s'], PAL['N']: PAL['S']}

SIGN_BOARD = [  # enseigne suspendue à une potence (posée sur une tuile de mur), 16 × 16
    '................',
    '..ZZZZZZZZZZZZ..',
    '....Z......Z....',
    '...bbbbbbbbbbn..',
    '...bkkkkkkkkBn..',
    '...bk......kBn..',
    '...bk......kBn..',
    '...bk......kBn..',
    '...bk......kBn..',
    '...bk......kBn..',
    '...bkkkkkkkkBn..',
    '...nnnnnnnnnnn..',
]
SIGN_EMBLEMS = {
    'jam': ['.RwRw.', 'RwRwRw', '.yyyy.', 'qRRRRq', 'qRkkRq', '.qqqq.'],
    'cheese': ['....i.', '..iiiy', 'iiiiiy', 'yyYyyY', 'yyyyYY', 'YYYYYo'],
    'bread': ['......', '.BBBB.', 'BkBBkB', 'BBBBBn', 'bbbbbn', '.nnnn.'],
}


def sign(emblem):
    g = Grid(16, 16)
    g.stamp(SIGN_BOARD, 0, 0)
    g.stamp(['kkkkkk'] * 6, 5, 4)
    g.stamp(SIGN_EMBLEMS[emblem], 5, 4)
    return art(g.rows(), outline=1)


AWNING = [
    'RRwwRRwwRRwwRRww',
    'RRwwRRwwRRwwRRww',
    'RRwwRRwwRRwwRRww',
    'RqWsRqWsRqWsRqWs',
    '.q.s.q.s.q.s.q.s',
]


def awning():
    t = art(['................', '................'] + AWNING, outline=1)
    return t


def windmill_body():
    g = Grid(48, 64)
    # tour de pierre chaulée, légèrement évasée
    for y in range(18, 62):
        k = (y - 18) / (61 - 18)
        x0 = round(15 - 5 * k)
        x1 = round(32 + 5 * k)
        for x in range(x0, x1 + 1):
            ch = 'W' if x < x0 + 3 else ('S' if x > x1 - 4 else 's')
            g.set(x, y, ch)
        # assises de pierre
        if y % 7 == 3:
            for x in range(x0 + 1, x1):
                if (x + y) % 5 != 0:
                    g.set(x, y, 'S' if g.get(x, y) != 'S' else 'M')
    for (x, y) in ((19, 28), (20, 28), (28, 43), (29, 43), (17, 50), (30, 33)):
        g.set(x, y, 'M')
    # porte en bois (arrondie), fenêtre
    g.stamp(['..nnnn..', '.nNNNNn.', 'nNnNnNNn', 'nNnNnNNn', 'nNnNnNNn', 'nNnNnNNn',
             'nNnNnNNn', 'nNnNnkNn', 'nNnNnNNn', 'nNnNnNNn', 'nNnNnNNn', 'nnnnnnnn'], 20, 50)
    g.stamp(['.MM.', 'McCM', 'MzzM', '.MM.'], 22, 36)
    # chapeau (toit conique en tuiles rouges)
    for y in range(4, 22):
        k = (y - 4) / (21 - 4)
        half = 2 + k * 11
        x0, x1 = round(23.5 - half), round(24.5 + half)
        for x in range(x0, x1 + 1):
            ch = 'r' if x < x0 + 3 else ('q' if x > x1 - 3 else 'R')
            if y % 4 == 3 and ch == 'R' and x % 2 == 0:
                ch = 'q'
            g.set(x, y, ch)
    for x in range(10, 38):
        g.set(x, 21, 'q' if x > 30 else 'R')
        g.set(x, 22, 'n')
    return art(g.rows(), w=48, h=64)


WINDMILL_HUB = (24, 20)   # centre des ailes, en pixels du sprite 48 × 64


def windmill_sails(angle_deg):
    hx, hy = WINDMILL_HUB
    g = Grid(48, 64)
    for b in range(4):
        a = math.radians(angle_deg + 90 * b)
        ux, uy = math.cos(a), -math.sin(a)
        vx, vy = -uy, ux
        for y in range(64):
            for x in range(48):
                rx, ry = x + 0.5 - hx, y + 0.5 - hy
                u = rx * ux + ry * uy
                v = rx * vx + ry * vy
                if 2 < u <= 20.5 and abs(v) <= 1.0:
                    g.set(x, y, 'n')
                elif 6.5 < u <= 20.5 and 1.0 < v <= 6.2:
                    edge = u > 19.5 or v > 5.2 or u < 7.5
                    lattice = (u - 6.5) % 4.5 < 1.0 or abs(v - 3.6) < 0.5
                    g.set(x, y, 'B' if edge else ('b' if lattice else 'W'))
    g.stamp(['.NN.', 'NnnN', 'NnnN', '.NN.'], hx - 2, hy - 2)
    return art(g.rows(), outline=1, w=48, h=64)


def bakery():
    g = Grid(32, 32)
    # mur de pierre
    for y in range(15, 31):
        for x in range(3, 29):
            ch = 'W' if x < 5 else ('S' if x > 26 else 's')
            g.set(x, y, ch)
    for (x, y) in ((8, 17), (9, 17), (20, 18), (26, 24), (5, 27), (6, 27), (13, 25)):
        g.set(x, y, 'M')
    # porte
    g.stamp(['nnnnnn', 'nNNNNn', 'nNnNNn', 'nNnNNn', 'nNnNkn', 'nNnNNn', 'nNnNNn', 'nNnNNn', 'nnnnnn'], 5, 22)
    # four : voûte de briques, bouche rougeoyante
    g.stamp(['...rrRRRr...', '..rRRRRRRq..', '.rRqoooooRq.', '.rRoYYYYoRq.', 'rRoYyiiyYoRq',
             'rRoYiiiiYoRq', 'rRoYyyyyYoRq', 'rRooooooooRq', 'qqqqqqqqqqqq'], 15, 21)
    # toit de tuiles rouges (débord), cheminée
    g.stamp(['..sSS', '.MMMM', '.sssS', '.sssS', '.sssS', '.sssS'], 21, 0)
    for y in range(4, 15):
        k = (y - 4) / 10
        x0, x1 = round(8 - 7 * k), round(23 + 7 * k)
        for x in range(x0, x1 + 1):
            ch = 'r' if x < x0 + 2 else ('q' if x > x1 - 2 else 'R')
            if y % 3 == 1 and ch == 'R' and x % 3 == 0:
                ch = 'q'
            g.set(x, y, ch)
    for x in range(1, 31):
        g.set(x, 14, 'q')
    return art(g.rows(), w=32, h=32)


def building_section():
    add('part.sign.jam', sign('jam'))
    add('part.sign.cheese', sign('cheese'))
    add('part.sign.bread', sign('bread'))
    add('part.awning', awning())
    add('part.wall.white.l', recolor(tile(4, 6, TOWN), WHITEWASH))
    add('part.wall.white.c', recolor(tile(5, 6, TOWN), WHITEWASH))
    add('part.wall.white.r', recolor(tile(7, 6, TOWN), WHITEWASH))
    add('part.wall.white.window', recolor(tile(4, 7, TOWN), WHITEWASH))
    add('part.wall.white.door', recolor(tile(5, 7, TOWN), WHITEWASH))
    add('part.roof.slate.white.l', recolor_region(tile(0, 5, TOWN), WOOD_TO_WHITE, (0, 14, 16, 16)))
    add('part.roof.slate.white.c', recolor_region(tile(1, 5, TOWN), WOOD_TO_WHITE, (0, 14, 16, 16)))
    add('part.roof.slate.white.r', recolor_region(tile(2, 5, TOWN), WOOD_TO_WHITE, (0, 14, 16, 16)))
    add('part.roof.slate.white.gable', recolor_region(tile(3, 5, TOWN), WOOD_TO_WHITE, (0, 8, 16, 16)))

    # Confiturerie 3 × 3 : toit de tuiles rouges, murs de pierre, auvent rayé, enseigne « pot de confiture »
    composite('building.jamworkshop', 3, 3, [
        ('town', 4, 4, 0, 0), ('town', 5, 4, 1, 0), ('town', 6, 4, 2, 0),
        ('town', 4, 5, 0, 1), ('town', 7, 5, 1, 1), ('town', 6, 5, 2, 1),
        ('town', 4, 7, 0, 2), ('town', 5, 7, 1, 2), ('town', 7, 6, 2, 2),
        ('v3', 'part.awning', 0, 2), ('v3', 'part.sign.jam', 2, 2),
    ])
    # Fromagerie 3 × 3 : toit d'ardoise, murs chaulés, enseigne « fromage »
    composite('building.dairy', 3, 3, [
        ('town', 0, 4, 0, 0), ('town', 1, 4, 1, 0), ('town', 2, 4, 2, 0),
        ('v3', 'part.roof.slate.white.l', 0, 1), ('v3', 'part.roof.slate.white.gable', 1, 1),
        ('v3', 'part.roof.slate.white.r', 2, 1),
        ('v3', 'part.wall.white.window', 0, 2), ('v3', 'part.wall.white.door', 1, 2),
        ('v3', 'part.wall.white.r', 2, 2), ('v3', 'part.sign.cheese', 2, 2),
    ])
    body = windmill_body()
    add('building.windmill.body', body)
    frames = [windmill_sails(a) for a in (0, 22.5, 45, 67.5)]
    for i, f in enumerate(frames):
        add(f'building.windmill.sails.{i}', f)
    composite('building.windmill', 3, 4, [
        ('v3', 'building.windmill.body', 0, 0), ('v3', 'building.windmill.sails.0', 0, 0),
    ])
    add('building.bakery', bakery())


SECTIONS = [crop_section, tree_section, goat_section, product_section, icon_section, farmer_section,
            deco_section, building_section]


def render_composite(name):
    for (n, w, h, layers) in COMPOSITES:
        if n != name:
            continue
        out = img(w * T, h * T)
        named = dict(ENTRIES)
        for layer in layers:
            if layer[0] == 'v3':
                _, a, dx, dy = layer
                src = named[a]
            else:
                sheet, a, b, dx, dy = layer
                src = tile(a, b, TOWN if sheet == 'town' else FARM)
            out.alpha_composite(src, (dx * T, dy * T))
        return out
    raise KeyError(name)


# ===========================================================================
# Placement dans la planche, écriture du PNG et du bloc de src/render/atlas.js

def pack():
    """Premier emplacement libre (lecture ligne par ligne) pour chaque sprite, 16 tuiles de large."""
    used = set()
    pos = {}
    for name, im in ENTRIES:
        w, h = im.width // T, im.height // T
        r = 0
        while name not in pos:
            for c in range(SHEET_COLS - w + 1):
                cells = {(c + i, r + j) for i in range(w) for j in range(h)}
                if not cells & used:
                    used |= cells
                    pos[name] = (c, r, w, h)
                    break
            r += 1
    rows = max(r + h for (c, r, w, h) in pos.values())
    return pos, rows


def js_entry(c, r, w, h):
    return f"{{ sheet: 'v3', col: {c}, row: {r}" + (f', w: {w}, h: {h}' if (w, h) != (1, 1) else '') + ' }'


def main():
    for fn in SECTIONS:
        fn()
    pos, rows = pack()
    sheet = img(SHEET_COLS * T, rows * T)
    for name, im in ENTRIES:
        c, r, w, h = pos[name]
        sheet.alpha_composite(im, (c * T, r * T))
    sheet.save(HERE / 'v3.png')
    lines = ['  // Généré par assets/sprites/generate-v3.py — ne pas modifier à la main.']
    for name, _ in ENTRIES:
        lines.append(f"  '{name}': {js_entry(*pos[name])},")
    for (name, w, h, layers) in COMPOSITES:
        ls = []
        for layer in layers:
            if layer[0] == 'v3':
                _, a, dx, dy = layer
                c, r, lw, lh = pos[a]
                ls.append(f"{{ sheet: 'v3', col: {c}, row: {r}, dx: {dx}, dy: {dy}"
                          + (f', w: {lw}, h: {lh}' if (lw, lh) != (1, 1) else '') + ' }')
            else:
                sh, a, b, dx, dy = layer
                ls.append(f"{{ sheet: '{sh}', col: {a}, row: {b}, dx: {dx}, dy: {dy} }}")
        lines.append(f"  '{name}': {{ w: {w}, h: {h}, layers: [\n    " + ',\n    '.join(ls) + ',\n  ] },')
    block = '\n'.join(lines)
    atlas = ROOT / 'src' / 'render' / 'atlas.js'
    src = atlas.read_text()
    new = re.sub(r'(// <v3:auto>\n).*?( *// </v3:auto>)', lambda m: m.group(1) + block + '\n' + m.group(2), src, flags=re.S)
    if new == src and '// <v3:auto>' not in src:
        raise SystemExit('marqueurs // <v3:auto> absents de src/render/atlas.js')
    atlas.write_text(new)
    print(f'écrit {HERE / "v3.png"} ({SHEET_COLS} × {rows} tuiles, {len(ENTRIES)} sprites, '
          f'{len(COMPOSITES)} composés)')


if __name__ == '__main__':
    main()
