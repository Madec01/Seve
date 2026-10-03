#!/usr/bin/env python3
"""Génère assets/sprites/valley1.png : sprites du lot V1 « La boîte en fer » de La Vallée vivante (style Kenney, CC0).

Contenu (voir docs/ARCHITECTURE.md, « Vallée vivante — contrats du lot V1 », tableau des sprites, et docs/VALLEE.md) :
  - variétés anciennes : heirloom.<id>.icon (12), heirloom.<id>.3 et .4 (11 cultures : plant et mûr aux couleurs de la
    variété ; les étapes 0 à 2, le fané et le pommier sont des alias vers la culture de base, posés à la fin du bloc),
    heirloom.rougeVifDEtampes.giant (32 × 32), heirloom.calvilleBlanc.fruit (pommes à poser sur tree.apple.*) ;
  - habitants : wild.<id> et wild.<id>.1 (12 espèces, regard vers la GAUCHE ; .1 = seconde image : pas, battement
    d'ailes, clin d'œil, saut…), indices wild.hint.<tracks|feather|eggs|nuts|note> ;
  - aménagements : haie champêtre nature.hedge.<saison>.<top|mid|bot> (autotuile verticale), bande fleurie
    nature.strip.<saison>[.1] (répétable en largeur), nature.nestbox / owlbox / woodpile, nature.insectHotel (16 × 32),
    nature.reeds[.1|.2], chêne nature.oak.sapling / young (16 × 32) / <saison> (32 × 48), jachère fleurie
    nature.fallow.<saison> (32 × 32), fleurs de lisière nature.edge.flowers.<0..2> ;
  - cueillette des haies hedgefind.<id>, boîte en fer valley.box[.open], étiquette valley.label (8 × 8), sachet
    seedpack.heirloom, vignette story.box (48 × 32), vignettes de la vallée valley.stage.<0..5> (96 × 48) ;
  - icônes : icon.valley, icon.signs, icon.trait.<id>, icon.nature.<kind>, onglets album.page.heirlooms / wildlife ;
  - ciel : fx.birds[.1] (16 × 16), fx.butterfly[.1] (8 × 8) ;
  - décors decor.seed.cabinet, decor.nestbox.painted, decor.valley.linden (32 × 32) ;
  - succès icon.ach.<id> (+ .locked grisée), même médaillon que career.png.

Même méthode que generate-lot4.py (palette Kenney et outils repris de generate-lot2.py / generate-v3.py /
generate-career.py) : dessins ASCII ou construits par programme, contour sombre (63, 38, 49), lumière en haut à
gauche ; 1 px de contour pour les icônes, les bêtes et les petits objets 16 × 16, 2 px pour les grands objets.
Les variétés reprennent les tuiles des cultures de base (Tiny Farm, v3.png) recolorées pixel à pixel, avec les
retouches de forme propres à chaque variété (côtes, cloques, rondeur…).

Sprites 8 × 8 : rangés par quatre dans une tuile de 16 px ; leur entrée d'atlas a des col/row demi-entiers et
w = h = 0.5.

Le script :
  1. dessine chaque sprite ;
  2. les range dans la planche (placement automatique, déterministe, 16 tuiles de large) ;
  3. écrit assets/sprites/valley1.png ;
  4. réécrit, dans src/render/atlas.js, le bloc compris entre « // <valley1:auto> » et « // </valley1:auto> »
     (le crée juste après « // </lot4:auto> » s'il n'existe pas encore) ;
  5. vérifie qu'aucun nom ne heurte un sprite des autres planches.

Relancer :  python3 assets/sprites/generate-valley1.py   (nécessite Pillow)
Planches de contrôle (×6, avec des originaux) : python3 assets/sprites/generate-valley1.py --contact DOSSIER
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


g2 = _load('gen_lot2', HERE / 'generate-lot2.py')
g3 = g2.g3
gc = _load('gen_career', HERE / 'generate-career.py')

T = 16
SHEET_COLS = 16
SHEET = 'valley1'
OUT = g3.OUT
FARM = g3.FARM
EXTRA = Image.open(HERE / 'extra.png').convert('RGBA')
img, tile, flip = g3.img, g3.tile, g3.flip
V3S, CAS = g2.V3S, g2.CAS
Grid = g2.Grid
LOT4 = Image.open(HERE / 'lot4.png').convert('RGBA')
L4S = g2.atlas_sprites('lot4', LOT4)
LOT2 = Image.open(HERE / 'lot2.png').convert('RGBA')
L2S = g2.atlas_sprites('lot2', LOT2)
LOT3 = Image.open(HERE / 'lot3.png').convert('RGBA')
L3S = g2.atlas_sprites('lot3', LOT3)

# Palette : celle du lot 2 (Kenney + ajouts carrière / lot 2), des teintes du lot 4 et quelques voisines.
PAL = dict(g2.PAL)
PAL.update({
    # jaune-vert (pomme Calville, mousse claire, courgette de Nice)
    '1': (236, 234, 150),
    '2': (199, 205, 98),
    '3': (146, 160, 64),
    '4': (104, 120, 52),
    # violet (vitelotte, asters, phacélie)
    '/': (196, 168, 214),
    '|': (132, 100, 160),
    '5': (88, 60, 116),
    # rouge très sombre (cœur de bœuf, prunelles, mûres)
    '6': (120, 28, 36),
    # noir bleuté (mûres, prunelles, calottes)
    '&': (40, 40, 52),
    '+': (70, 70, 88),
    # kraft (sachets)
    '(': (214, 170, 118),
    ')': (176, 128, 84),
    # neige et givre
    '=': (214, 226, 244),
    '-': (168, 186, 220),
    # pierre
    '[': (210, 200, 186),
    ']': (160, 148, 136),
    # vert sombre (chou de Milan, chêne d'été, roseaux)
    '7': (52, 104, 66),
    # fer-blanc de la boîte (bleu-vert passé)
    '!': (150, 196, 186),
    '@': (96, 150, 146),
    '#': (60, 102, 104),
    # roux (écureuil, blé rouge, lièvre)
    '$': (214, 112, 60),
    '%': (160, 70, 40),
    # brun-gris (chouette, hérisson, lièvre)
    '*': (176, 140, 104),
    '~': (128, 96, 72),
    ';': (88, 64, 52),
    # bleu du geai et des bleuets
    ':': (70, 120, 220),
    ',': (40, 72, 160),
    # rose-brun du geai
    '?': (184, 130, 112),
    "'": (236, 196, 172),
})


def art(rows, outline=2, w=None, h=None, pal=None):
    return g3.art(rows, outline=outline, pal=pal or PAL, w=w, h=h)


def icon(src, pal=None, w=16, h=16):
    """Icône au contour fin (1 px), comme assets/sprites/ui/icons.png."""
    rows = rows_of(src) if isinstance(src, str) else src
    assert len(rows) <= h and all(len(r) <= w for r in rows), src
    return art(rows, outline=1, w=w, h=h, pal=pal)


def rows_of(src):
    return [l for l in src.strip('\n').split('\n')]


def paint(im, rows, x0=0, y0=0):
    """Peint un petit dessin ASCII par-dessus (sans contour ; « . » = inchangé, « _ » = transparent)."""
    if isinstance(rows, str):
        rows = rows_of(rows)
    px = im.load()
    for y, line in enumerate(rows):
        for x, ch in enumerate(line):
            if ch in '. ':
                continue
            if 0 <= x0 + x < im.width and 0 <= y0 + y < im.height:
                px[x0 + x, y0 + y] = (0, 0, 0, 0) if ch == '_' else (OUT if ch == 'A' else PAL[ch]) + (255,)
    return im


def over(base, top, x=0, y=0):
    out = base.copy()
    out.alpha_composite(top, (x, y))
    return out


def shift(im, dx, dy):
    out = img(im.width, im.height)
    out.paste(im, (dx, dy), im)
    return out


def recolor(im, mapping, box=None):
    """Remplace des couleurs exactes (mapping : rgb source → rgb ou lettre de PAL) ; box = (x0, y0, x1, y1) inclus."""
    im = im.copy()
    px = im.load()
    m = {k: (PAL[v] if isinstance(v, str) else v) for k, v in mapping.items()}
    for y in range(im.height):
        for x in range(im.width):
            if box and not (box[0] <= x <= box[2] and box[1] <= y <= box[3]):
                continue
            p = px[x, y]
            if p[3] and p[:3] in m:
                px[x, y] = m[p[:3]] + (p[3],)
    return im


def outline_alpha(im, ring=1):
    """Ajoute un contour sombre (8-voisins) autour des pixels opaques d'une image."""
    out = im.copy()
    src = im.load()
    px = out.load()
    for y in range(im.height):
        for x in range(im.width):
            if src[x, y][3]:
                continue
            if any(0 <= x + dx < im.width and 0 <= y + dy < im.height and src[x + dx, y + dy][3]
                   for dx in (-1, 0, 1) for dy in (-1, 0, 1)):
                px[x, y] = OUT + (255,)
    return out


def sparkle(im, x, y, big=False):
    return g2.mini_sparkle(im, x, y, big=big)


def glow(im, cx, cy, r, color=(255, 226, 140), alpha=120):
    return g2.glow(im, cx, cy, r, color=color, alpha=alpha)


ellipse = Grid.cells_ellipse.__get__(Grid(1, 1))   # cellules d'une ellipse (fonction libre)

K = {k: v for k, v in PAL.items()}   # raccourci : lettre → rgb


# ---------------------------------------------------------------------------
# Registre : nom → image

ENTRIES = []   # (nom, image) dans l'ordre de placement
SMALL = []     # (nom, image 8 × 8), rangés par quatre
ALIASES = []   # (nom, nom_cible)
_seen = set()


def add(name, im):
    assert name not in _seen, name
    assert im.width % T == 0 and im.height % T == 0, (name, im.size)
    _seen.add(name)
    ENTRIES.append((name, im))
    return im


def add8(name, im):
    assert name not in _seen, name
    assert im.size == (8, 8), (name, im.size)
    _seen.add(name)
    SMALL.append((name, im))
    return im


def alias(name, target):
    assert name not in _seen, name
    _seen.add(name)
    ALIASES.append((name, target))


def get(name):
    for n, im in ENTRIES + SMALL:
        if n == name:
            return im
    raise KeyError(name)


# ===========================================================================
# 1. Les variétés anciennes

def ft(c, r):
    return tile(c, r)


def xt(c, r):
    return EXTRA.crop((c * T, r * T, c * T + T, r * T + T))


# Tuiles de base de chaque culture : (plant = étape 3, mûr = étape 4, icône)
BASE = {
    'carrot': (ft(5, 0), ft(6, 0), ft(8, 0)),
    'turnip': (ft(5, 1), ft(6, 1), ft(8, 1)),
    'corn': (xt(3, 0), ft(6, 2), ft(8, 2)),
    'tomato': (ft(5, 3), ft(6, 3), ft(8, 3)),
    'cabbage': (xt(6, 0), ft(6, 4), ft(8, 4)),
    'wheat': (xt(4, 0), ft(6, 5), ft(8, 5)),
    'sunflower': (xt(5, 0), ft(11, 6), ft(11, 6)),
}
for _cid in ('pumpkin', 'potato', 'strawberry', 'zucchini'):
    BASE[_cid] = (V3S[f'crop.{_cid}.3'], V3S[f'crop.{_cid}.4'], V3S[f'crop.{_cid}.icon'])

# id → culture (docs/VALLEE.md § 3.2)
VARIETIES = {
    'jauneDuDoubs': 'carrot', 'bouleDOr': 'turnip', 'rougeDeBordeaux': 'wheat', 'milanDePontoise': 'cabbage',
    'coeurDeBoeuf': 'tomato', 'grandRouxBasque': 'corn', 'soleilDOr': 'sunflower', 'vitelotte': 'potato',
    'reineDesVallees': 'strawberry', 'rondeDeNice': 'zucchini', 'rougeVifDEtampes': 'pumpkin',
    'calvilleBlanc': 'apple',
}

Y_, y_, o_, i_ = K['Y'], K['y'], K['o'], K['i']
TINTS = {   # correspondance de couleurs exactes (rgb de la culture de base → rgb de la variété)
    'jauneDuDoubs': {y_: (252, 240, 160), Y_: (236, 204, 92), o_: (176, 146, 58)},
    'bouleDOr': {K['P']: y_, K['Q']: Y_, K['l']: (255, 236, 168)},
    'rougeDeBordeaux': {y_: K['$'], Y_: K['%'], i_: (240, 168, 116)},
    'milanDePontoise': {K['g']: (156, 200, 108), K['G']: (88, 150, 82), K['d']: K['7']},
    'coeurDeBoeuf': {K['R']: (172, 38, 44), K['r']: (226, 82, 72)},
    'grandRouxBasque': {y_: (242, 146, 76), Y_: (190, 76, 46)},
    'soleilDOr': {K['n']: K['N'], y_: (255, 214, 64), i_: (255, 240, 150), Y_: (232, 150, 24)},
    'vitelotte': {K['k']: (216, 192, 232), K['b']: K['/'], K['B']: K['|'], K['n']: K['5']},
    'reineDesVallees': {K['R']: (224, 52, 66), K['q']: (150, 28, 44), K['r']: (255, 124, 112), i_: (255, 238, 170)},
    'rondeDeNice': {},
    'rougeVifDEtampes': {Y_: (216, 74, 44), o_: (150, 40, 32), y_: (242, 122, 72), i_: (255, 178, 132)},
}


def is_fruit_px(p, cid):
    """Pixel « fruit » d'une tuile de culture (ni vert, ni contour)."""
    if not p[3] or p[:3] == OUT:
        return False
    r, g_, b = p[:3]
    return not (g_ > r + 12 and g_ > b)


def ribs(im, cols, colors, test, y0=0, y1=15):
    """Côtes : colonnes `cols` assombries (rgb `colors` : source → sombre) sur les pixels qui passent `test`."""
    px = im.load()
    for x in cols:
        for y in range(y0, y1 + 1):
            p = px[x, y]
            if p[3] and test(p[:3]) and p[:3] in colors:
                px[x, y] = colors[p[:3]] + (255,)
    return im


def milan_blisters(im, src):
    """Cloques du chou de Milan : petits creux sombres en quinconce sur les feuilles claires de la pomme."""
    px = im.load()
    sp = src.load()
    for y in range(im.height):
        for x in range(im.width):
            if sp[x, y][:3] == K['g'] and sp[x, y][3] and (x + 2 * y) % 4 == 1:
                px[x, y] = (110, 168, 90, 255)
    return im


def vitelotte_icon():
    """Pomme de terre violette allongée, un peu courbe, yeux clairs."""
    g = Grid(16, 16)
    cells = {}
    for y in range(16):
        for x in range(16):
            # axe oblique de (2.5, 11.5) à (13.5, 4.5), légère courbure
            t = ((x + 0.5 - 2.5) * 11 + (y + 0.5 - 11.5) * -7) / (11 * 11 + 7 * 7)
            if not -0.05 <= t <= 1.05:
                continue
            cx, cy = 2.5 + 11 * t, 11.5 - 7 * t + 1.2 * math.sin(math.pi * t)
            half = 3.1 * math.sin(math.pi * min(1, max(0, t * 0.96 + 0.02))) ** 0.55
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            if d <= half:
                nx, ny = (x + 0.5 - cx) / max(half, 0.1), (y + 0.5 - cy) / max(half, 0.1)
                cells[(x, y)] = '/|5'[g2.shade_index((nx, ny), '/|5')]
    g.layer(cells)
    for (x, y) in ((5, 9), (9, 7), (11, 6)):
        if g.get(x, y) != '.':
            g.set(x, y, 'k')
    for (x, y) in ((4, 9), (6, 7)):
        g.set(x, y, '/')
    g.set(5, 8, 'w')
    return icon(g.rows())


def reine_icon():
    """Trois petites fraises des bois coniques, collerettes vertes."""
    berry = ['.GdG.', 'GRrRG', '.RiR.', '.RRq.', '..q..']
    g = Grid(16, 16)
    g.stamp(['..d....', '...d...', '....d..', '...dd..'], 6, 1)
    g.stamp_ring(['.GdG.', 'GrriG', 'RriRR', '.RRq.', '.RiR.', '..q..'], 1, 6)
    g.stamp_ring(['.GdG.', 'GrRiG', 'RrRRq', 'RiRRq', '.RRq.', '..q..'], 9, 5)
    g.stamp_ring(berry, 5, 9)
    g.stamp(['.GG', 'GdG', 'dG.'], 6, 3)
    im = icon(g.rows())
    return recolor(im, TINTS['reineDesVallees'])


def ronde_icon():
    """Courgette ronde de Nice : boule vert pâle marbrée, pédoncule."""
    g = Grid(16, 16)
    g.ball(8, 9, 6.0, 5.8, '12G3', ring='A', light=(-0.5, -0.7, 0.55))
    for (x, y) in ((5, 6), (6, 9), (5, 12), (8, 5), (9, 8), (8, 12), (11, 7), (11, 11), (10, 13)):
        if g.get(x, y) not in '.A':
            g.set(x, y, 'g' if g.get(x, y) in '12' else '2')
    g.stamp(['.dd', 'dd.', 'd..'], 7, 1)
    g.set(6, 6, 'w')
    return icon(g.rows())


def ronde_ripe(base):
    """Plant de courgette (étape 3) avec deux courgettes rondes au pied."""
    im = base.copy()
    g = Grid(16, 16)
    g.ball(4.5, 12.0, 3.2, 3.0, '12G', ring='A')
    g.ball(11.5, 12.5, 3.0, 2.8, '12G', ring='A')
    for (x, y) in ((4, 11), (11, 12), (3, 13)):
        g.set(x, y, 'g')
    g.set(3, 10, 'w')
    fr = art(g.rows(), outline=1, w=16, h=16)
    return over(im, fr)


def etampes_icon():
    """Citrouille rouge vif d'Étampes : aplatie, côtes marquées."""
    g = Grid(16, 16)
    lobes = [(3.4, 2.9, -0.3), (12.6, 2.9, -0.25), (5.8, 3.4, -0.1), (10.2, 3.4, -0.05), (8.0, 3.2, 0.1)]
    for i, (cx, rx, bias) in enumerate(lobes):
        g.ball(cx, 10.0, rx, 4.4 - (0.6 if i < 2 else 0), 'iyYo', ring='o' if i else 'A', bias=bias)
    for x in range(6, 11):
        if g.get(x, 6) in 'iyY':
            g.set(x, 6, 'o')
    g.stamp(['.dN', 'dN.', 'N..'], 7, 3)
    g.set(6, 8, 'i')
    im = icon(g.rows())
    return recolor(im, TINTS['rougeVifDEtampes'])


def coeur_icon(base):
    """Cœur de bœuf : la tomate de base, plus sombre, côtes profondes."""
    im = recolor(base, TINTS['coeurDeBoeuf'])
    dark = {(172, 38, 44): K['6'], (226, 82, 72): (172, 38, 44)}
    ribs(im, (5, 8, 11), dark, lambda c: True, y0=5, y1=11)
    px = im.load()
    for x in (4, 7, 10):   # creux au sommet entre les lobes
        if px[x, 4][3] and px[x, 4][:3] in dark:
            px[x, 4] = OUT + (255,)
    return im


def calville_icon():
    """Pomme Calville blanc d'hiver : jaune-vert, côtelée, rose léger."""
    g = Grid(16, 16)
    lobes = [(4.6, 3.0, -0.25), (11.4, 3.0, -0.2), (6.8, 3.4, -0.05), (9.2, 3.4, 0.0), (8.0, 3.0, 0.1)]
    for i, (cx, rx, bias) in enumerate(lobes):
        g.ball(cx, 9.6, rx, 5.0 - (0.8 if i < 2 else 0.2 if i < 4 else 0), '123', ring='3' if i else 'A', bias=bias)
    for x in range(6, 11):
        if g.get(x, 5) in '123':
            g.set(x, 5, '3')
    g.stamp(['..N', '.N.', 'N..'], 7, 1)
    g.stamp(['GG.', 'Gdd', '.dd'], 9, 1)
    g.set(5, 7, 'w')
    g.set(11, 11, 'e')
    g.set(12, 10, 'e')
    return icon(g.rows())


def calville_fruit():
    """Pommes de Calville posées sur le pommier : les pommes de tree.apple.summer.ripe, recolorées."""
    ripe, plain = V3S['tree.apple.summer.ripe'], V3S['tree.apple.summer']
    out = img(16, 16)
    a, b, o = ripe.load(), plain.load(), out.load()
    cmap = {K['R']: K['2'], K['r']: K['1'], K['q']: K['3'], K['p']: K['1'], K['E']: K['2'], K['e']: K['1']}
    for y in range(16):
        for x in range(16):
            if a[x, y] != b[x, y] and a[x, y][3]:
                c = a[x, y][:3]
                o[x, y] = cmap.get(c, K['2'] if c != OUT else OUT) + (255,)
    return out


def heirloom_ripe(vid, cid):
    plant, ripe, ico = BASE[cid]
    tint = TINTS[vid]
    r3 = recolor(plant, tint)
    r4 = recolor(ripe, tint)
    ic = recolor(ico, tint)
    if vid == 'milanDePontoise':
        r3 = milan_blisters(r3, plant)
        r4 = milan_blisters(r4, ripe)
        ic = milan_blisters(ic, ico)
    elif vid == 'coeurDeBoeuf':
        ic = coeur_icon(ico)
        dark = {(172, 38, 44): K['6']}
        px = r4.load()
        # une côte sombre au milieu de chaque tomate mûre
        for (x, y) in ((4, 5), (4, 6), (11, 3), (11, 4), (11, 9), (11, 10), (6, 11), (6, 12)):
            if px[x, y][3] and px[x, y][:3] in dark:
                px[x, y] = dark[px[x, y][:3]] + (255,)
    elif vid == 'vitelotte':
        ic = vitelotte_icon()
    elif vid == 'reineDesVallees':
        ic = reine_icon()
    elif vid == 'rondeDeNice':
        r4 = ronde_ripe(plant)
        ic = ronde_icon()
    elif vid == 'rougeVifDEtampes':
        ic = etampes_icon()
        px = r4.load()
        dark = {(216, 74, 44): (150, 40, 32), (242, 122, 72): (216, 74, 44)}
        ribs(r4, (4, 7, 9, 12), dark, lambda c: True, y0=7, y1=14)
    return r3, r4, ic


def heirloom_section():
    for vid, cid in VARIETIES.items():
        if cid == 'apple':
            continue
        r3, r4, ic = heirloom_ripe(vid, cid)
        add(f'heirloom.{vid}.icon', ic)
        if r3.tobytes() != BASE[cid][0].tobytes():
            add(f'heirloom.{vid}.3', r3)
        add(f'heirloom.{vid}.4', r4)
    add('heirloom.calvilleBlanc.icon', calville_icon())
    add('heirloom.calvilleBlanc.fruit', calville_fruit())
    add('heirloom.rougeVifDEtampes.giant', recolor(g2.giant_pumpkin(), TINTS['rougeVifDEtampes']))


# ===========================================================================
# 2. Les habitants (regard vers la GAUCHE ; deux images)

WILD_ART = {
    'ladybird': ["""
................
................
................
..........dd....
.......ddGGGd...
.....dGGgGGGGd..
....dGgGGGGGGd..
...dGgGGgGGGGd..
..dGgGGGgGGGdd..
..dGGGGGgGGdd...
..dGGGGGGgdd....
...ddGGGGddd....
....dddddd.d....
...........d....
................
................
""", """
................
................
................
..........dd....
.......ddGGGd...
.....dGGgGGGGd..
....dGgGGGGGGd..
...dGgGGgGGGGd..
..dGgGGGgGGGdd..
..dGGGGGgGGdd...
..dGGGGGGgdd....
...ddGGGGddd....
....dddddd.d....
...........d....
................
................
"""],
    'bumblebee': ["""
................
................
................
................
.......WW.......
......WccW.WW...
......WccWWccW..
.......WWWccW...
.....&&yy&&yyw..
....&&&yyy&&yww.
....&w&yyy&&yww.
....&&&YYY&&YYw.
.....&&YYY&&YY..
......&.&..&.&..
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
..WWcc...WWcc...
.WccW&&yWccWyw..
....&&&yyy&&yww.
....&w&yyy&&yww.
....&&&YYY&&YYw.
.....&&YYY&&YY..
.....&..&..&..&.
................
................
"""],
    'butterfly': ["""
................
................
..yRRR....RRRy..
.y&:yRR..RRy:&y.
.R:w:RRR&RRR:w:.
.RR:RRRR&RRRR:R.
..RRRRRq&qRRRR..
...qRRRq&qRRRq..
....&RRR&RRR&...
...&R&yR&Ry&R&..
...&RR&R&R&RR&..
....&&&.&.&&&...
................
................
................
................
""", """
................
................
..;;........;;..
..;~;......;~;..
..;R~;....;~R;..
..;~*~;..;~*~;..
...;~~~;;~~~;...
...;~*~&&~*~;...
....;~~&&~~;....
....;;~&&~;;....
......;&&;......
.......&&.......
................
................
................
................
"""],
    'swallow': ["""
................
................
.............,,.
...........,,,,.
.........,,,,,..
.......,,,,,,...
..R,,,,,,,,,,,,,
.Rq,,wwww,,,,..,
..,wwwww,,,,...,
.....,,,,,......
.......,,,,.....
.........,,,,...
...........,,,..
.............,..
................
................
""", """
................
................
................
................
................
................
..R,,,,,,,,,,,,.
.Rq,,wwww,,,,..,
..,wwwww,,,,,,,,
......,,,,,,,...
........,,,,,...
..........,,,...
................
................
................
................
"""],
    'tawnyOwl': ["""
................
....~.....~.....
....~~~~~~~~....
...~*****~**~...
...~*&&**&&*~...
...~*&w**&w*~...
...~**&*y&**~...
...~~***y***~...
...~~~*~~*~~~...
...~*~~*~~*~~...
...~~*~~*~~~;...
....;~*~~*~;....
....;;~~~~;;....
.....yy..yy.....
................
................
""", """
................
....~.....~.....
....~~~~~~~~....
...~*****~**~...
...~********~...
...~*&&**&&*~...
...~********~...
...~~***y***~...
...~~~*~~*~~~...
...~*~~*~~*~~...
...~~*~~*~~~;...
....;~*~~*~;....
....;;~~~~;;....
.....yy..yy.....
................
................
"""],
    'frog': ["""
................
................
................
................
................
....bbb.........
...bwAbb........
..bAAbBBBb......
.bBBBBBBBBBb....
.NNBBnBBBBBBb...
..kkkBBAAAABBb..
...kkBAbbbnABb..
...kkAbnbbbABn..
...BB.AAAAABBn..
..BBB.BBB..BBn..
................
""", """
................
................
................
................
....bbb.........
...bwAbbb.......
..bAABBBBBBb....
.BBBBBBnBBBBBb..
.NNkBBBBBBnBBBbb
..kkkBBnBBBBBnBB
...kB......BnB.B
..BB.........BB.
.BB.............
................
................
................
"""],
    'dragonfly': ["""
................
................
.....cW....cW...
......cW..cW....
.......cWcW.....
..,::::::::,,,,,
.&:,:::::::,,,,.
..,::::::::.....
.......cWcW.....
......cW..cW....
.....cW....cW...
................
................
................
................
................
""", """
................
................
................
......cWW..cWW..
.......cWWcWW...
..,::::::::,,,,,
.&:,:::::::,,,,.
..,::::::::.....
.......cWWcWW...
......cWW..cWW..
................
................
................
................
................
................
"""],
    'hare': ["""
................
.....;..;.......
.....*..*.......
.....**.**......
.....*'*'*......
......****......
.....*&****.....
....;******~....
.....w****~~~...
......w***~~~~..
......w****~~~w.
......**~~~~~~w.
......*.*~~~~~..
.....**.**..**..
................
................
""", """
................
................
................
................
..;;............
...**;..........
....***.........
...*&***~.......
..;*****~~~~~...
...ww***~~~~~~..
....ww***~~~~~w.
.....*~~~~~~~~ww
....**.~~...~~..
...**.........~~
................
................
"""],
    'squirrel': ["""
................
..........$$$...
.........$$$$$..
....%...$$%$$$$.
...$%..$$%%%$$$.
...$$$$$%%%%$$$.
..$&$$$$%%%$$$..
.$$$$$$%%%$$$...
..%'$$$%%$$$....
...''$$$$$$.....
...''$$$$$......
...$'$$$$.......
..$$.$$$........
................
................
................
""", """
................
................
...........$$...
..........$$$$..
....%....$$$$$$.
...$%...$$%%$$$.
...$$$$$%%%$$$$.
..$&$$$$%%$$$$..
.$$$$$$%%$$$$...
..%'$$$%$$$$....
..BB'$$$$$$.....
..nB'$$$$$......
...$'$$$$.......
..$$.$$$........
................
................
"""],
    'jay': ["""
................
................
.....??'........
....?'''?.......
...?''&'??......
..yy&'''??......
....&?'????.....
.....??????w....
.....?'?:w:&&...
......?',:,&&&..
.......??:w&&&&.
........w?.&&&&&
........y..y....
................
................
................
""", """
................
................
................
................
................
.......?'?......
......?'''??....
.....?''&'??....
....?'''??????w.
...yy&?'???:w:&&
.....&??'??,:,&&
.......???w:w&&&
..........w...&&
.........y.y....
................
................
"""],
}


def ladybird_frame(frame):
    """Trois coccinelles sur une grande feuille ; à la seconde image, elles ont avancé d'un pas."""
    g = Grid(16, 16)
    g.stamp(rows_of(WILD_ART['ladybird'][0]), 0, 0)
    bug = ['.EE.', '&pEE', '&E&E', '.EE.']
    spots = [(3, 7), (8, 3), (9, 9)] if frame == 0 else [(2, 6), (7, 4), (8, 9)]
    for (x, y) in spots:
        g.stamp(bug, x, y)
    if frame == 1:   # une coccinelle entrouvre ses élytres
        g.stamp(['.WEE', '.EWE'], 8, 9)
    return art(g.rows(), outline=1, w=16, h=16)


def wild_frame(sid, frame):
    if sid == 'robin':
        return flip(L4S['bird.robin.1' if frame else 'bird.robin'])
    if sid == 'hedgehog':
        return flip(L2S['hedgehog.walk.1' if frame else 'hedgehog'])
    if sid == 'ladybird':
        return ladybird_frame(frame)
    return art(rows_of(WILD_ART[sid][frame]), outline=1, w=16, h=16)


SPECIES = ['robin', 'hedgehog', 'ladybird', 'bumblebee', 'butterfly', 'swallow', 'tawnyOwl', 'frog', 'dragonfly',
           'hare', 'squirrel', 'jay']


def wild_section():
    for sid in SPECIES:
        add(f'wild.{sid}', wild_frame(sid, 0))
        add(f'wild.{sid}.1', wild_frame(sid, 1))


HINTS = {
    'tracks': """
................
..........N.N...
.........N.N....
..........NN....
..........NN....
................
....N.N.........
...N.N..........
....NN......N.N.
....NN.....N.N..
............NN..
............NN..
.N.N............
N.N.............
.NN.............
.NN.............
""",
    'feather': """
................
................
............AA..
...........A:,A.
..........A:w,A.
.........A,::wA.
........A:w,,A..
.......A,::wA...
......A:w,,A....
.....A,&&:A.....
....A&ww&A......
...A:,&&A.......
...A,,AA........
..AnAA..........
.AnA............
..A.............
""",
}


def hint_tracks():
    """Empreintes dans l'herbe : petits coussinets et doigts, en diagonale."""
    im = img(16, 16)
    px = im.load()
    prints = [(2, 11), (5, 6), (10, 9), (12, 3)]
    for (x, y) in prints:
        for (dx, dy, c) in ((0, 0, 'N'), (1, 0, 'N'), (0, 1, 'N'), (1, 1, 'H'), (-1, -2, 'N'), (1, -2, 'N'),
                            (2, -1, 'N'), (-1, 0, '.')):
            if c != '.':
                px[x + dx, y + dy] = PAL[c] + (230,)
    return im


def hint_feather():
    return art(rows_of(HINTS['feather']), outline=0, w=16, h=16)


def hint_eggs():
    """Grappe d'œufs de grenouille dans un peu d'eau."""
    g = Grid(16, 16)
    g.ball(8, 9.5, 7.0, 5.0, 'cCC', ring=None)
    for (x, y) in ellipse(8, 9.5, 7.0, 5.0):
        if y <= 6 and g.get(x, y) == 'C':
            g.set(x, y, 'c')
    eggs = [(4, 7), (7, 6), (10, 7), (5, 10), (8, 9), (11, 10), (7, 12), (10, 12)]
    for (x, y) in eggs:
        g.stamp(['.W.', 'WsW', '.s.'], x - 1, y - 1)
    im = art(g.rows(), outline=1, w=16, h=16)
    px = im.load()
    for (x, y) in eggs:
        px[x, y] = (40, 40, 52, 255)   # embryon noir au centre
    for (x, y) in ((3, 9), (12, 8)):
        px[x, y] = (255, 255, 255, 255)
    return im


def hint_nuts():
    """Noisettes rongées : coquilles ouvertes et une entière."""
    g = Grid(16, 16)
    g.ball(5, 10, 3.2, 3.0, 'bBn', ring='A')
    g.stamp(['.kk.', 'kAAk', '.kk.'], 3, 9)
    g.ball(11, 11, 3.0, 2.8, 'bBn', ring='A')
    g.stamp(['k.', 'Ak', 'Ak', 'k.'], 11, 9)
    for x in range(9, 13):
        g.set(x, 13, 'n')
    g.ball(9.5, 5.5, 2.6, 2.6, 'bBn', ring='A')
    g.stamp(['GdG'], 8, 2)
    g.set(8, 4, 'k')
    for (x, y) in ((2, 14), (14, 7), (13, 4)):
        g.set(x, y, 'B')
    return art(g.rows(), outline=1, w=16, h=16)


def hint_note():
    """Petite note de musique (chant, hululement, bourdonnement)."""
    rows = rows_of("""
................
................
.......wwwwww...
.......wWWWWw...
.......w....w...
.......w....w...
.......w....w...
.......w....w...
.......w....w...
....www....ww...
...wwWw...wwW...
...wWWw...wWW...
....ww.....w....
................
................
................
""")
    im = art(rows, outline=1, w=16, h=16)
    return im


def hints_section():
    add('wild.hint.tracks', hint_tracks())
    add('wild.hint.feather', hint_feather())
    add('wild.hint.eggs', hint_eggs())
    add('wild.hint.nuts', hint_nuts())
    add('wild.hint.note', hint_note())


# ===========================================================================
# 3. Les aménagements

SEASONS = ['spring', 'summer', 'autumn', 'winter']


def outline_mask(im, mask, color=OUT):
    """Contour 1 px (8-voisins) autour d'un masque de cellules (l'intérieur peut rester troué)."""
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            if (x, y) in mask:
                continue
            if any((x + dx, y + dy) in mask for dx in (-1, 0, 1) for dy in (-1, 0, 1)):
                px[x, y] = color + (255,)
    return im


def grid_image(g, mask=None, outline=True):
    """Grille de lettres → image (sans contour automatique) ; contour autour de `mask` (ou des cellules peintes)."""
    im = img(g.w, g.h)
    px = im.load()
    cells = set()
    for y in range(g.h):
        for x in range(g.w):
            ch = g.get(x, y)
            if ch not in '._':
                px[x, y] = (OUT if ch == 'A' else PAL[ch]) + (255,)
                cells.add((x, y))
    if outline:
        outline_mask(im, mask if mask is not None else cells)
    return im


HEDGE_RAMPS = {'spring': 'jGd', 'summer': 'Gd7', 'autumn': 'GJ4', 'winter': '=VU'}
HEDGE_H = 80   # haut (16) + 3 milieux + bas (16) : le milieu central se raccorde à lui-même


def hedge_mask():
    """Silhouette d'une haie verticale (bords qui ondulent avec une période de 16 px, bouts arrondis)."""
    mask = set()
    for y in range(HEDGE_H):
        k = y % 16
        l = 1 + (1 if k in (3, 4, 5, 11, 12) else 0)
        r = 14 - (1 if k in (7, 8, 9, 15, 0) else 0)
        for x in range(l, r + 1):
            # bouts arrondis : haut (y < 7) et bas (y > HEDGE_H - 6)
            if y < 7:
                d = ((x + 0.5 - 8) / 7.0) ** 2 + ((y + 0.5 - 7) / 6.0) ** 2
                if d > 1:
                    continue
            if y > HEDGE_H - 5:
                d = ((x + 0.5 - 8) / 7.0) ** 2 + ((y + 0.5 - (HEDGE_H - 5)) / 3.5) ** 2
                if d > 1:
                    continue
            mask.add((x, y))
    return mask


# Touffes de feuilles d'une période de 16 px (cx, cy, rayon) : se recouvrent comme les buissons Kenney
HEDGE_CLUMPS = [(4.5, 1.5, 4.2), (11.5, 4.0, 4.2), (5.0, 8.0, 4.4), (11.0, 11.5, 4.2), (4.5, 14.5, 4.0),
                (8.0, 6.0, 3.0), (8.5, 13.5, 3.0)]


def hedge_leafy(season):
    g = Grid(16, HEDGE_H)
    mask = hedge_mask()
    ramp = HEDGE_RAMPS[season]
    # fond sombre partout dans la silhouette, puis les touffes (période 16), liseré sombre entre elles
    for (x, y) in mask:
        g.set(x, y, ramp[2])
    for rep in range(-1, HEDGE_H // 16 + 1):
        for (cx, cy, r) in HEDGE_CLUMPS:
            cells = {}
            for (x, y) in ellipse(cx, cy + 16 * rep, r, r * 0.9):
                if (x, y) in mask:
                    nx, ny = (x + 0.5 - cx) / r, (y + 0.5 - cy - 16 * rep) / (r * 0.9)
                    cells[(x, y)] = ramp[g2.shade_index((nx, ny), ramp)]
            g.layer(cells, ring=ramp[2])
    rnd = random.Random(7)
    if season == 'spring':   # aubépine (blanc) et églantier (rose)
        dots = [(3, 2, 'w'), (10, 4, 'K'), (6, 7, 'w'), (12, 9, 'w'), (4, 11, 'K'), (9, 13, 'w'), (13, 14, 'w'),
                (7, 0, 'K')]
        for rep in range(HEDGE_H // 16 + 1):
            for (x, y, c) in dots:
                yy = y + 16 * rep
                if (x, yy) in mask and (x + 1, yy) in mask and (x, yy + 1) in mask:
                    g.set(x, yy, c)
                    g.set(x + 1, yy, 'W' if c == 'w' else 'L')
                    g.set(x, yy + 1, 'W' if c == 'w' else 'L')
                    if c == 'w':
                        g.set(x + 1, yy + 1, 'y')
    elif season == 'autumn':   # cynorhodons et aubépines rouges, prunelles et mûres noires
        dots = [(3, 3, 'E'), (11, 2, '&'), (7, 6, 'E'), (12, 8, 'E'), (4, 10, '&'), (9, 12, 'E'), (5, 14, 'E'),
                (13, 13, '&')]
        for rep in range(HEDGE_H // 16 + 1):
            for (x, y, c) in dots:
                yy = y + 16 * rep
                if (x, yy) in mask and (x + 1, yy + 1) in mask:
                    g.set(x, yy, c)
                    g.set(x + 1, yy, 'q' if c == 'E' else '+')
                    g.set(x, yy + 1, 'q' if c == 'E' else '+')
                    g.set(x + 1, yy + 1, 'q' if c == 'E' else '&')
                    if c == 'E':
                        g.set(x, yy, 'p')
        for (x, y) in mask:   # feuilles rousses et jaunies
            if g.get(x, y) in 'GJ' and (x * 7 + y * 3) % 7 == 0:
                g.set(x, y, 'Y' if (x + y) % 2 else 'y')
    elif season == 'summer':
        for (x, y) in mask:
            if g.get(x, y) == 'G' and (x * 5 + y * 3) % 13 == 0:
                g.set(x, y, 'j')
    return grid_image(g, mask)


def hedge_winter():
    """Haie nue givrée : masse de rameaux gris-brun, givre sur le dessus de chaque touffe, brindilles sombres."""
    g = Grid(16, HEDGE_H)
    mask = hedge_mask()
    ramp = HEDGE_RAMPS['winter']
    for (x, y) in mask:
        g.set(x, y, ';')
    for rep in range(-1, HEDGE_H // 16 + 1):
        for (cx, cy, r) in HEDGE_CLUMPS:
            cells = {}
            for (x, y) in ellipse(cx, cy + 16 * rep, r, r * 0.9):
                if (x, y) in mask:
                    nx, ny = (x + 0.5 - cx) / r, (y + 0.5 - cy - 16 * rep) / (r * 0.9)
                    k = g2.shade_index((nx, ny), ramp, cuts=[0.7, 0.0])
                    cells[(x, y)] = ('=' if (x + y) % 3 else 'W') if k == 0 else 'V' if k == 1 else '~'
            g.layer(cells, ring=';')
    # brindilles : petits traits sombres en biais dans la masse
    for (x, y) in sorted(mask):
        if g.get(x, y) in 'V~' and (x + 2 * y) % 5 == 0:
            g.set(x, y, ';')
    for rep in range(HEDGE_H // 16 + 1):   # quelques cynorhodons restés
        for (x, y) in ((5, 6), (10, 13)):
            if (x, y + 16 * rep) in mask:
                g.set(x, y + 16 * rep, 'E')
    return grid_image(g, mask)


def hedge_section():
    for season in SEASONS:
        full = hedge_winter() if season == 'winter' else hedge_leafy(season)
        add(f'nature.hedge.{season}.top', full.crop((0, 0, 16, 16)))
        add(f'nature.hedge.{season}.mid', full.crop((0, 32, 16, 48)))
        add(f'nature.hedge.{season}.bot', full.crop((0, HEDGE_H - 16, 16, HEDGE_H)))


# --- Bande fleurie (répétable en largeur ; les deux variantes se raccordent dans n'importe quel ordre) ---------

STRIP_FLOWERS = {
    'spring': [('E', 'q', '&'), (':', ',', 'w')],        # coquelicots, bleuets
    'summer': [('w', 'W', 'y'), ('w', 'W', 'y')],        # marguerites
    'autumn': [('/', '|', 'y'), ('P', 'Q', 'y')],        # asters mauves
    'winter': [('i', 'y', 'o'), ('y', 'Y', 'o')],        # graines sèches dorées
}


STRIP_RAMPS = {'spring': 'jGd', 'summer': 'jGd', 'autumn': 'GJd', 'winter': '(VU'}


def strip_tile(season, variant):
    """Bande basse de feuillage (touffes de période 16, comme la haie couchée) et fleurs posées dessus."""
    W = 48
    g = Grid(W, 16)
    ramp = STRIP_RAMPS[season]
    mask = set()
    for x in range(W):
        top = 7 + (1 if x % 16 in (3, 4, 9, 10, 11) else 0) - (1 if x % 16 in (6, 7, 14) else 0)
        for y in range(top, 15):
            mask.add((x, y))
            g.set(x, y, ramp[2])
    clumps = [(2.0, 10.5, 3.2), (7.0, 9.5, 3.4), (12.0, 10.5, 3.2), (4.5, 13.0, 3.0), (10.0, 13.0, 3.0),
              (15.0, 12.5, 2.6)]
    for rep in range(-1, 4):
        for (cx, cy, r) in clumps:
            cells = {}
            for (x, y) in ellipse(cx + 16 * rep, cy, r, r * 0.85):
                if (x, y) in mask:
                    nx, ny = (x + 0.5 - cx - 16 * rep) / r, (y + 0.5 - cy) / (r * 0.85)
                    cells[(x, y)] = ramp[g2.shade_index((nx, ny), ramp)]
            g.layer(cells, ring=ramp[2])
    # fleurs (variante) dans la tuile du milieu, loin des bords
    spots = [(3, 6), (7, 4), (11, 7), (5, 10), (9, 9), (13, 11)] if variant == 0 else \
        [(2, 8), (6, 5), (9, 8), (12, 5), (7, 11), (11, 11)]
    for k, (fx, fy) in enumerate(spots):
        x, y = 16 + fx, fy
        c1, c2, c3 = STRIP_FLOWERS[season][k % 2]
        if season == 'winter':   # tête de graines sèche
            cells = {(x, y): c1, (x - 1, y + 1): c2, (x + 1, y + 1): c2, (x, y + 1): c3, (x, y - 1): c1,
                     (x, y + 2): 'F'}
        elif season == 'summer':  # marguerite : pétales blancs autour d'un cœur jaune
            cells = {(x, y): c3, (x - 1, y): c1, (x + 1, y): c2, (x, y - 1): c1, (x, y + 1): c2}
        else:
            cells = {(x, y): c3, (x - 1, y): c1, (x + 1, y): c1, (x, y - 1): c1, (x, y + 1): c2,
                     (x - 1, y + 1): c2, (x + 1, y + 1): c2}
        if y < 7:   # tige jusqu'au feuillage
            for yy in range(y + 2, 9):
                cells.setdefault((x, yy), 'd' if season != 'winter' else 'F')
        for (cx, cy), ch in cells.items():
            g.set(cx, cy, ch)
            mask.add((cx, cy))
    im = grid_image(g, mask)
    return im.crop((16, 0, 32, 16))


def strip_section():
    for season in SEASONS:
        add(f'nature.strip.{season}', strip_tile(season, 0))
        add(f'nature.strip.{season}.1', strip_tile(season, 1))


NESTBOX = """
................
.......AA.......
......ANNA......
.....ANnnNA.....
....ANnnnnNA....
...ANNNNNNNNA...
....bkkkkkkB....
....bkbbbbbB....
....bkbAAbbB....
....bkbAAbbB....
....bkbbbbbB....
....bkbbVbbB....
....bBBBBBBB....
.......VU.......
.......VU.......
......VVUU......
"""

OWLBOX = """
....]]]..]]]....
....]......]....
..ANNNNNNNNNNA..
.ANnnnnnnnnnnNA.
.ANNNNNNNNNNNNA.
..bkkkkkkkkkkB..
..bkbbbbbbbbbB..
..bkbAAAAAbbbB..
..bkbAAAAAbbbB..
..bkbAAAAAbbbB..
..bkbbbbbbbbbB..
..bkbbbbbbbbbB..
..bkbbbVVbbbbB..
..bBBBBBBBBBBB..
...UU......UU...
................
"""


def woodpile():
    g = Grid(16, 16)
    # pierres sèches à gauche et en bas
    g.ball(3.5, 12.5, 3.0, 2.6, '[]]', ring='A')
    g.ball(12.5, 13.0, 3.0, 2.2, '[]]', ring='A')
    # bûches empilées : bouts ronds (cernes)
    for (cx, cy) in ((6.5, 11.5), (10.5, 11.0), (8.5, 7.5), (4.5, 7.8), (12.0, 7.2)):
        g.ball(cx, cy, 2.4, 2.4, 'nnn', ring='A')
        g.ball(cx, cy, 1.6, 1.6, 'kkb', ring=None)
        g.set(int(cx), int(cy), 'B')
    g.ball(8.0, 4.0, 2.2, 2.1, 'nnn', ring='A')
    g.ball(8.0, 4.0, 1.4, 1.3, 'kkb', ring=None)
    g.set(8, 4, 'B')
    # mousse
    for (x, y) in ((3, 6), (4, 6), (7, 3), (8, 2), (11, 6), (12, 6), (2, 11), (3, 10), (12, 11)):
        g.set(x, y, 'm' if (x + y) % 2 else 'G')
    return art(g.rows(), outline=1, w=16, h=16)


INSECT_HOTEL = """
................
.......AA.......
......ANNA......
.....ANnnNA.....
....ANnnnnNA....
...ANnnnnnnNA...
..ANNNNNNNNNNA..
...BBBBBBBBBB...
...BkAkAkAkAB...
...BAkAkAkAkB...
...BkAkAkAkAB...
...BBBBBBBBBB...
...BnoNnBRRRB...
...BonoNBRARB...
...BnonoBRRRB...
...BNonnBRARB...
...BBBBBBBBBB...
...ByYyYyYyYB...
...BYyYyYyYyB...
...ByYyYyYyYB...
...BBBBBBBBBB...
...BVAVAVBbbB...
...BAVAVABbbB...
...BVAVAVBnbB...
...BAVAVABbnB...
...BBBBBBBBBB...
....UU....UU....
....UU....UU....
................
................
................
................
"""


def reeds(variant):
    """Roseaux (feuilles étroites ombrées), massettes brunes et iris jaunes."""
    g = Grid(16, 16)
    leaves = [[(3, 15, 1, 3), (7, 15, 8, 1), (11, 15, 13, 4)],
              [(4, 15, 2, 5), (9, 15, 11, 2), (13, 15, 14, 7)],
              [(2, 15, 3, 4), (6, 15, 5, 2), (10, 15, 12, 3), (14, 15, 14, 8)]][variant]
    for (x0, y0, x1, y1) in leaves:
        g.layer(g2.leaf_cells(x0 + 0.5, y0 + 0.5, x1 + 0.5, y1 + 0.5, 1.25, ramp='jGd', vein='G'), ring='d')
    heads = [[(5, 3), (10, 6)], [(7, 4)], [(8, 3)]][variant]
    for (x, y) in heads:   # massette : tige et épi brun
        g.line(x, y + 3, x, 15, 'd')
        g.stamp_ring(['N', 'n', 'n', 'N'], x, y)
        g.set(x, y - 1, 'd')
    irises = [[], [(4, 7), (12, 9)], [(11, 7)]][variant]
    for (x, y) in irises:
        g.line(x, y + 2, x, 15, 'd')
        g.stamp_ring(['y.y', 'yiy', '.Y.'], x - 1, y - 1)
    return art(g.rows(), outline=1, w=16, h=16)


def _outline_parts(im, parts):
    """Contour seulement autour de certaines cellules (fleurs, massettes), sans recouvrir le reste du dessin."""
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            if (x, y) in parts or px[x, y][3]:
                continue
            if any((x + dx, y + dy) in parts for dx in (-1, 0, 1) for dy in (-1, 0, 1)):
                px[x, y] = OUT + (255,)
    return im


def nature_objects_section():
    add('nature.nestbox', art(rows_of(NESTBOX), outline=1, w=16, h=16))
    add('nature.owlbox', art(rows_of(OWLBOX), outline=1, w=16, h=16))
    add('nature.woodpile', woodpile())
    add('nature.insectHotel', art(rows_of(INSECT_HOTEL), outline=1, w=16, h=32))
    add('nature.reeds', reeds(0))
    add('nature.reeds.1', reeds(1))
    add('nature.reeds.2', reeds(2))


# --- Le chêne isolé -------------------------------------------------------------------------------------------

OAK_RAMPS = {'spring': 'gjG', 'summer': 'Gd7', 'autumn': 'y$%'}

# Touffes de la couronne du chêne adulte (centre x, centre y, rayon) : large, bosselée, plus basse que haute
OAK_CLUMPS = [(9, 15, 6.0), (23, 15, 6.0), (16, 11, 7.0), (6, 22, 5.0), (26, 22, 5.0), (12, 24, 6.0), (21, 24, 6.0),
              (16, 18, 6.5), (11, 8, 4.5), (21, 8, 4.5), (3, 17, 3.2), (29, 17, 3.2)]


def oak_crown(g, clumps, ramp, ring, mask=None):
    """Couronne en touffes (Kenney) : la silhouette est l'union des touffes, liseré sombre entre elles."""
    for (cx, cy, r) in clumps:
        cells = {}
        for (x, y) in ellipse(cx, cy, r, r * 0.9):
            nx, ny = (x + 0.5 - cx) / r, (y + 0.5 - cy) / (r * 0.9)
            cells[(x, y)] = ramp[g2.shade_index((nx, ny), ramp)]
        g.layer(cells, ring=ring)


def oak_trunk(g, x0, y0, y1, w):
    for y in range(y0, y1 + 1):
        for x in range(x0, x0 + w):
            g.set(x, y, 'n' if x == x0 else 'N' if x == x0 + w - 1 else 'B' if (x + y) % 4 else 'n')


def thick_line(g, x0, y0, x1, y1, w, light='B', dark='N'):
    n = max(abs(x1 - x0), abs(y1 - y0), 1)
    for i in range(n + 1):
        x, y = x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n
        for k in range(w):
            g.set(round(x - (w - 1) / 2 + k), round(y), dark if k == w - 1 else light)


def oak_branches(g):
    """Charpente du chêne : tronc trapu, trois maîtresses branches qui se divisent (déterministe)."""
    segs = []

    def grow(x, y, ang, length, w, depth):
        x1 = x + math.cos(ang) * length
        y1 = y - math.sin(ang) * length
        segs.append((x, y, x1, y1, w))
        if depth == 0:
            return
        for da in (-0.5, 0.45):
            grow(x1, y1, ang + da, length * 0.68, max(1, w - 1), depth - 1)

    for ang, ln in ((math.pi * 0.78, 9), (math.pi * 0.5, 10), (math.pi * 0.24, 9)):
        grow(16, 30, ang, ln, 3, 2)
    for (x0, y0, x1, y1, w) in segs:
        thick_line(g, round(x0), round(y0), round(x1), round(y1), w)
    return segs


def oak_adult(season):
    W, H = 32, 48
    g = Grid(W, H)
    if season == 'winter':
        segs = oak_branches(g)
        oak_trunk(g, 13, 29, 44, 6)
        g.stamp(['nn......nN', '.nn....nN.'], 11, 44)
        for (x0, y0, x1, y1, w) in segs:   # neige posée sur le dessus des branches
            n = max(abs(x1 - x0), abs(y1 - y0), 1)
            for i in range(0, int(n) + 1):
                x, y = round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n)
                yy = y - 1
                while g.get(x, yy) in 'BNn':
                    yy -= 1
                if g.get(x, yy) == '.' and abs(x1 - x0) > abs(y1 - y0) * 0.5:
                    g.set(x, yy, 'W')
        for (x, y) in ((13, 29), (14, 28), (17, 28), (18, 29)):
            g.set(x, y, 'W')
        g.stamp(['..==WWWW==..', '.==========.'], 10, 45)
        return art(g.rows(), outline=1, w=W, h=H)
    ramp = OAK_RAMPS[season]
    oak_trunk(g, 13, 26, 44, 6)
    g.stamp(['nn......nN', '.nn....nN.'], 11, 44)
    g.stamp(['n', 'n'], 11, 43)
    g.stamp(['N', 'N'], 20, 43)
    oak_crown(g, OAK_CLUMPS, ramp, ring=ramp[2])
    # creux sombres sous la couronne : on voit les branches
    g.stamp(['.nB.', 'nBBN', 'BBNN'], 14, 28)
    if season == 'spring':   # chatons jaune pâle
        for (x, y) in ((7, 12), (13, 8), (21, 11), (25, 18), (9, 22), (18, 21), (14, 15), (23, 25), (5, 18)):
            g.set(x, y, 'i')
            g.set(x, y + 1, '2')
    elif season == 'autumn':   # glands
        for (x, y) in ((8, 15), (20, 10), (24, 21), (12, 24), (17, 17), (6, 21)):
            g.stamp(['N', 'b', 'n'], x, y)
        for (x, y) in ((10, 46), (21, 46), (23, 45)):   # feuilles tombées
            g.set(x, y, '$')
    else:
        for (x, y) in ((7, 12), (13, 8), (21, 11), (25, 18), (9, 22), (18, 21)):
            g.set(x, y, 'j')
    return art(g.rows(), outline=1, w=W, h=H)


def oak_sapling():
    rows = rows_of("""
................
................
................
.......V........
......jVj.......
.....jGVGj......
......GVGd......
.....jdVjG......
......dVd.......
.......VN.......
......wVN.......
.......VN.......
.......VN.......
.......VN.......
......BbbB......
.....BBBBBB.....
""")
    g = Grid(16, 16)
    g.stamp(rows, 0, 0)
    return art(g.rows(), outline=1, w=16, h=16)


def oak_young():
    g = Grid(16, 32)
    oak_trunk(g, 7, 17, 29, 2)
    g.set(6, 29, 'n')
    g.set(9, 29, 'N')
    oak_crown(g, [(5, 8, 3.6), (11, 8, 3.6), (8, 5, 3.8), (5, 14, 3.6), (11, 14, 3.6), (8, 11, 3.8)], 'Gd7',
              ring='7')
    for (x, y) in ((5, 7), (9, 4), (10, 11), (6, 13)):
        g.set(x, y, 'j')
    return art(g.rows(), outline=1, w=16, h=32)


def oak_section():
    add('nature.oak.sapling', oak_sapling())
    add('nature.oak.young', oak_young())
    for season in SEASONS:
        add(f'nature.oak.{season}', oak_adult(season))


# --- Jachère fleurie (sur la terre labourée de la parcelle) ---------------------------------------------------

def fallow(season):
    """Plantes en touffes sur une grille décalée (la terre se voit entre elles)."""
    g = Grid(32, 32)
    rnd = random.Random({'spring': 11, 'summer': 12, 'autumn': 13, 'winter': 14}[season])
    spots = []
    for r in range(4):
        for c in range(4):
            spots.append((4 + c * 8 + (4 if r % 2 else 0) + rnd.randint(-1, 1), 5 + r * 7 + rnd.randint(-1, 1)))
    spots = [(x if x < 30 else x - 30 + 2, y) for (x, y) in spots]
    for i, (x, y) in enumerate(spots):
        if season == 'winter':
            # couvert vert bas (moutarde, vesce), givre sur les feuilles
            g.stamp_ring(['.GjG.', 'GjGdG', 'dGdGd'], x - 2, y - 1, ring='A')
            for (dx, dy) in ((-1, -1), (1, 0), (0, 1)):
                if g.get(x + dx, y + dy) in 'jG':
                    g.set(x + dx, y + dy, '=')
            continue
        # feuillage de base
        g.stamp_ring(['.G.G.', 'GdGdG'], x - 2, y + 1, ring='A')
        if season == 'spring':   # coquelicots
            g.stamp_ring(['.EE.', 'EpEq', 'EE&q', '.qq.'], x - 2, y - 3, ring='A')
            g.set(x, y + 1, 'd')
        elif season == 'summer':   # phacélie : épis bleu-violet recourbés
            g.stamp_ring(['./|.', '/:|:', '.:|,', '..d.'], x - 2, y - 3, ring='A')
        else:   # trèfle (boules roses) et marguerites
            if i % 2:
                g.stamp_ring(['.KL.', 'KLLO', '.LO.', '.d..'], x - 2, y - 3, ring='A')
            else:
                g.stamp_ring(['.w.', 'wyW', '.W.', '.d.'], x - 1, y - 3, ring='A')
    return art(g.rows(), outline=1, w=32, h=32)


def fallow_section():
    for season in SEASONS:
        add(f'nature.fallow.{season}', fallow(season))


EDGE_FLOWERS = [
    """
................
................
................
................
................
................
................
.........w......
....w...wyw.....
...wyw...w......
....w..d.d......
....d..d.d..w...
..d.d.dd.d.wyw..
..ddd.d..dd.w...
...dGdGddGddGd..
................
""",
    """
................
................
................
................
................
.....K..........
....KLK.........
.....L..........
....KLO....P....
.....d....PQP...
....KdK....d....
.....d...P.d....
...GdddG.d.d....
...GdGdGdGdG....
................
................
""",
    """
................
................
................
................
................
................
................
................
..:..........y..
.:,:...:....yiy.
..d...:,:....y..
..d.:..d..:..d..
.Gd:,:.d.:,:.d..
.GdGdGdGdGdGdG..
................
................
""",
]


def edge_section():
    for i, src in enumerate(EDGE_FLOWERS):
        add(f'nature.edge.flowers.{i}', art(rows_of(src), outline=1, w=16, h=16))


# ===========================================================================
# 4. Cueillette des haies, boîte en fer, étiquette, sachet

HEDGE_FINDS = {
    'blackberry': """
................
.........dd.....
........dGGd....
.......dGjGd....
......d.dGd.....
.....d...d......
....&5&..d......
...&5w5&&5&.....
...5&5&5w5&.....
...&5&5&5&5.....
....&5&5&5&.....
.....&5&5&......
......&5&.......
.......&........
................
................
""",
    'elderflower': """
................
....w.w.w.w.....
...wWwWwWwWw....
..wWiWwWiWwWw...
..WwWwWiWwWwW...
...WwWwWwWwW....
....s.s.s.s.....
.....s.s.s......
......sss.......
.......d........
......dd........
.....dGd........
....dGjGd.......
.....dGd........
................
................
""",
    'sloe': """
................
........d.......
.......dGd......
......dGjGd.....
....N..dGd......
...N....N.......
..N....N.N......
.zxz..zxz.N.....
zsxzzzsxzzzxz...
zxzzzzxzzzsxzz..
zzzz..zzzzzzzz..
.zz....zz..zz...
................
................
................
................
""",
    'hazelnut': """
................
................
....GG...GG.....
...GjdG.GjdG....
..GjGdGGjGdG....
..dGkkdGGkkd....
...kbbBkkbbB....
..kbbbBbbbbBn...
..bbbBBbbbBBn...
..bbBBnbbBBn....
...BBnn.BBnn....
....nn...nn.....
................
................
................
................
""",
}


def hedgefind_section():
    for fid, src in HEDGE_FINDS.items():
        add(f'hedgefind.{fid}', art(rows_of(src), outline=1, w=16, h=16))


def valley_box(opened):
    """Boîte à biscuits en fer cabossée, peinte de fleurs passées ; ouverte : sachets de papier dedans."""
    if not opened:
        rows = rows_of("""
................
................
................
................
..@@@@@@@@@@@@..
.@!!!!!!!!!!!!@.
.@!!K!!!!!w!!!@.
.@#@@@@@@@@@@##.
..!!!!!!!!!!!@..
..!L!!y!!!K!!@..
..!!!yiy!!!!!@..
..!K!!y!!L!w!@..
..!!!!G!!!!!!#..
..@!!!!!!!!!@#..
..@@@@@@@@@@##..
................
""")
    else:
        rows = rows_of("""
................
.@@@@@@@@@@@@...
.@!!!!!!!!!!@...
.@!!K!!!!w!!@...
.@@@@@@@@@@@@...
................
...(()...(().....
..@(w(@@@(w(@@..
..(()(()(()(.@..
..!()(w)()()(@..
..!(()(()(()!@..
..!K!!y!!L!w!@..
..!!!!G!!!!!!#..
..@!!!!!!!!!@#..
..@@@@@@@@@@##..
................
""")
    im = art(rows, outline=1, w=16, h=16)
    if not opened:   # bosse (cabossée) : un pixel de contour rentré
        px = im.load()
        px[13, 9] = PAL['#'] + (255,)
    return im


def valley_label():
    rows = rows_of("""
........
.kkkkk..
.kNbNk..
.kkkkk..
...b....
...b....
...b....
........
""")
    return art(rows, outline=1, w=8, h=8)


def seedpack_heirloom():
    rows = rows_of("""
................
.....E....E.....
......E..E......
....((EEEE((....
....(((EE(((....
....((((((((....
....)(((((((....
....)((NNN((....
....)(NnbbN(....
....)(Nbkbn(....
....)((Nbn((....
....)(((nd((....
....)((((((d....
....))))))))....
................
................
""")
    return art(rows, outline=1, w=16, h=16)


def small_items_section():
    hedgefind_section()
    add('valley.box', valley_box(False))
    add('valley.box.open', valley_box(True))
    add8('valley.label', valley_label())
    add('seedpack.heirloom', seedpack_heirloom())


# ===========================================================================
# 5. Vignettes : la boîte en fer (48 × 32) et la vallée vue de loin (96 × 48, une par étape)

def frame_border(im):
    px = im.load()
    W, H = im.size
    for x in range(W):
        px[x, 0] = OUT + (255,)
        px[x, H - 1] = OUT + (255,)
    for y in range(H):
        px[0, y] = OUT + (255,)
        px[W - 1, y] = OUT + (255,)
    return im


def story_box():
    """Joseph ouvre la boîte en fer sur la table de la cuisine : sachets, vieille photo, fenêtre."""
    g = Grid(48, 32)
    # mur de la cuisine (crépi chaud) et lambris
    g.rect(0, 0, 47, 19, 'f')
    for (x, y) in ((5, 3), (12, 9), (30, 4), (41, 12), (21, 2), (36, 8), (3, 14)):
        g.set(x, y, 'F')
    g.rect(0, 16, 47, 20, 'B')
    g.rect(0, 16, 47, 16, 'b')
    for x in range(3, 48, 5):
        g.rect(x, 17, x, 20, 'n')
    # fenêtre (à gauche) : la vallée dehors, rideaux
    g.rect(3, 2, 15, 12, 'N')
    g.rect(4, 3, 14, 11, 'c')
    g.rect(4, 8, 14, 11, 'G')
    g.rect(4, 10, 14, 11, 'd')
    g.set(7, 7, 'd'); g.set(8, 6, 'd'); g.set(8, 7, 'd'); g.set(12, 7, 'd')
    g.rect(9, 3, 9, 11, 'N')
    g.rect(4, 7, 14, 7, 'N') if False else None
    g.rect(2, 1, 4, 13, 'R'); g.rect(14, 1, 16, 13, 'R')
    g.rect(2, 1, 16, 1, 'q')
    # étagère : bocaux
    g.rect(31, 6, 46, 6, 'n')
    g.stamp(['.ss.', 'sWWs', 'sYyS', 'sYYS'], 32, 2)
    g.stamp(['.ss.', 'sWWs', 'sRrS', 'sRRS'], 37, 2)
    g.stamp(['.ss.', 'sWWs', 'sGjS', 'sGGS'], 42, 2)
    # Joseph derrière la table, de face : casquette, barbe blanche, chemise à carreaux
    g.stamp(['...JJJJJJ...', '..JJJJJJJJ..', '.JJJJJJJJJJd', '...ffffff...', '...fZffZf...', '..hfffefff..',
             '..WWWffWWW..', '..WWWWWWWW..', '...WWWWWW...', '....WWWW....'], 18, 3)
    for y in range(13, 22):
        for x in range(15, 33):
            if abs(x - 23.5) <= 5 + (y - 13) * 0.9:
                g.set(x, y, 'q' if (x % 3 == 0 or y % 3 == 0) else 'R')
    # table (planche claire) devant
    g.rect(0, 21, 47, 31, 'b')
    g.rect(0, 21, 47, 21, 'k')
    for y in (25, 29):
        g.rect(0, y, 47, y, 'B')
    # mains et boîte ouverte au centre
    g.stamp(['.@@@@@@@@@@.', '@!!!!!!!!!!@', '@((((()(((!@', '@(w(()(w(()@', '@!!K!!y!!L!@', '@!!!!G!!!!!#',
             '.@@@@@@@@@#.'], 18, 19)
    g.stamp(['ff', 'fF'], 16, 21)
    g.stamp(['ff', 'Ff'], 30, 21)
    # couvercle posé à côté (fleurs passées)
    g.stamp(['@@@@@@@@', '@!K!!w!@', '@!!y!!!@', '@######@'], 36, 22)
    # sachets épars et vieille photo (sépia, bord blanc)
    g.stamp(['((E(', '(()(', '()((', ')))('], 6, 23)
    g.stamp(['.((E', '((((', '(N((', ')))('], 11, 25)
    g.stamp(['wwwwww', 'wVUUVw', 'wUkkUw', 'wUnnUw', 'wwwwww'], 38, 26)
    im = art(g.rows(), outline=0, w=48, h=32)
    return frame_border(im)


def lerp(c0, c1, t):
    return tuple(round(a + (b - a) * t) for a, b in zip(c0, c1))


def valley_stage(n):
    """La même vallée vue de loin : du gris-brun (étape 0) au vert vivant (étape 5)."""
    W, H = 96, 48
    t = n / 5
    im = Image.new('RGBA', (W, H), (0, 0, 0, 255))
    px = im.load()
    rnd = random.Random(42)

    def put(x, y, c, a=255):
        if 0 <= x < W and 0 <= y < H:
            px[x, y] = c + (a,)

    # ciel : deux bandes, du gris voilé au bleu
    sky_hi = lerp((170, 168, 172), (121, 180, 238), t)
    sky_lo = lerp((196, 190, 186), (170, 222, 250), t)
    for y in range(0, 22):
        for x in range(W):
            put(x, y, sky_hi if y < 8 else sky_lo)
    # nuages : lourds et gris au début, petits et blancs à la fin
    cloud = lerp((150, 146, 150), (255, 255, 255), t)
    for (cx, cy, rx) in ((18, 5, 8 - n), (60, 3, 10 - n), (84, 8, 6 - n // 2)):
        if rx <= 1:
            continue
        for (x, y) in ellipse(cx, cy, rx, 2.2):
            put(x, y, cloud)
    # collines du fond
    far = lerp((150, 136, 122), (120, 178, 110), t)
    far_d = lerp((126, 112, 102), (90, 150, 88), t)
    ridge = [int(13 + 3 * math.sin(x / 11.0) + 2 * math.sin(x / 5.3 + 1)) for x in range(W)]
    for x in range(W):
        for y in range(ridge[x], 24):
            put(x, y, far if y < ridge[x] + 2 else far_d)
    # lisière de forêt sur la colline : arbres morts (gris) → arbres verts ronds
    tree_c = lerp((120, 106, 100), (78, 151, 76), t)
    tree_l = lerp((140, 126, 118), (132, 198, 105), t)
    for x0 in range(2, W, 6):
        y0 = ridge[x0] + 1
        if t < 0.3 and (x0 // 6) % 2 == 0:   # tronc nu
            for y in range(y0 - 5, y0 + 1):
                put(x0, y, (96, 84, 80))
            put(x0 - 1, y0 - 4, (96, 84, 80)); put(x0 + 1, y0 - 3, (96, 84, 80))
        else:
            r = 2.4 + (0.6 if (x0 // 6) % 3 == 0 else 0)
            for (x, y) in ellipse(x0, y0 - 2, r, r):
                put(x, y, tree_l if (x < x0 and y < y0 - 2) else tree_c)
    # fond de vallée : champs en bandes obliques
    bare = (176, 136, 100)
    ground = lerp((166, 150, 128), (132, 198, 105), t)
    for y in range(22, H):
        for x in range(W):
            put(x, y, ground)
    fields = []   # (x0, y0, x1, y1, couleur vivante)
    alive_cols = [(132, 198, 105), (253, 214, 120), (100, 170, 90), (234, 165, 108), (160, 210, 120),
                  (253, 190, 83), (120, 186, 100), (198, 229, 141)]
    k = 0
    for row, (y0, y1) in enumerate(((23, 29), (30, 37), (38, 47))):
        xs = [0, 18 + row * 4, 40 + row * 3, 63 - row * 2, 96]
        for i in range(4):
            col = alive_cols[k % len(alive_cols)]
            k += 1
            fields.append((xs[i], y0, xs[i + 1] - 1, y1, col))
    for i, (x0, y0, x1, y1, col) in enumerate(fields):
        green_share = max(0.0, min(1.0, t * 1.4 - (i % 4) * 0.12))
        c = lerp(bare, col, green_share)
        cd = lerp((150, 112, 84), lerp(col, (60, 100, 60), 0.25), green_share)
        for y in range(y0, y1 + 1):
            for x in range(x0 + 1, x1):
                put(x, y, cd if (y - y0) % 3 == 2 else c)   # sillons / rangs
    # haies entre les champs : de plus en plus nombreuses
    hedge_c, hedge_l = (78, 151, 76), (110, 180, 90)
    hedge_lines = [(fields[i][0], fields[i][1], fields[i][0], fields[i][3]) for i in range(len(fields)) if fields[i][0] > 0]
    hedge_lines += [(0, 29, 95, 29), (0, 37, 95, 37)]
    show = round(len(hedge_lines) * min(1.0, n / 4))
    order = [6, 0, 3, 7, 1, 4, 8, 2, 5, 9, 10]
    for j in order[:show]:
        if j >= len(hedge_lines):
            continue
        x0, y0, x1, y1 = hedge_lines[j]
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                put(x, y, hedge_c)
                if x0 == x1:
                    put(x + 1, y, hedge_c if y % 3 else hedge_l)
                elif x % 3 == 0:
                    put(x, y - 1, hedge_l)
        if n >= 2:   # fleurs et baies sur les haies
            for (x, y) in ((x0, y0 + 2), ((x0 + x1) // 2, (y0 + y1) // 2), (x1, y1 - 1)):
                put(x, y, (255, 255, 255) if n < 4 else (255, 190, 170))
    # ruisseau : lit sec (pierres) → filet d'eau → ruisseau bleu
    for y in range(18, H):
        cx = 30 + 10 * math.sin((y - 18) / 7.0) - (y - 18) * 0.5
        w = 1 + (1 if y > 30 else 0) + (1 if n >= 2 else 0)
        for dx in range(-w, w + 1):
            x = int(cx + dx)
            if n == 0:
                put(x, y, (200, 184, 150) if (x + y) % 4 else (150, 140, 130))
            else:
                water = lerp((160, 170, 160), (90, 160, 232), min(1, t * 1.6))
                put(x, y, (190, 230, 255) if (dx == -w + 1 and y % 4 == 0 and n >= 2) else water)
        if n == 1:
            continue
    # la ferme (repère, ne change pas) : petite maison, toit rouge
    hx, hy = 70, 32
    for y in range(hy, hy + 5):
        for x in range(hx, hx + 7):
            put(x, y, (254, 201, 156) if y > hy else (234, 165, 108))
    for i in range(5):
        for x in range(hx - 1 + i, hx + 8 - i):
            put(x, hy - 1 - i, (195, 75, 53) if i else (170, 44, 35))
    put(hx + 2, hy + 2, (118, 59, 54)); put(hx + 2, hy + 3, (118, 59, 54))
    put(hx + 5, hy + 2, (153, 216, 248))
    # arbres isolés dans la vallée : morts → verts, de plus en plus nombreux
    for i, (x0, y0) in enumerate(((10, 34), (52, 27), (86, 40), (44, 44), (24, 26), (80, 26))):
        if i > 1 + n:
            continue
        if n == 0:
            for y in range(y0 - 5, y0 + 1):
                put(x0, y, (96, 84, 80))
            put(x0 - 1, y0 - 4, (96, 84, 80)); put(x0 + 1, y0 - 3, (96, 84, 80)); put(x0 + 2, y0 - 4, (96, 84, 80))
        else:
            put(x0, y0, (118, 59, 54)); put(x0, y0 - 1, (118, 59, 54))
            for (x, y) in ellipse(x0, y0 - 4, 3, 2.8):
                put(x, y, lerp((120, 140, 100), (132, 198, 105), t) if (x < x0 and y < y0 - 4) else
                    lerp((100, 116, 90), (78, 151, 76), t))
    # étape 5 : le tilleul en fleurs près de la ferme
    if n >= 5:
        x0, y0 = 61, 37
        for (x, y) in ellipse(x0, y0 - 7, 6.5, 5.5):   # contour sombre
            put(x, y, (63, 38, 49))
        for y in range(y0 - 3, y0 + 1):
            put(x0, y, (118, 59, 54)); put(x0 + 1, y, (63, 38, 49))
        for (x, y) in ellipse(x0, y0 - 7, 5.5, 4.6):
            lit = (x - x0) + (y - y0 + 7) < 0
            put(x, y, (236, 234, 150) if (x * 3 + y) % 5 == 0 else (139, 216, 125) if lit else (78, 151, 76))
    # fleurs dans les prés (étapes 2+)
    if n >= 2:
        cols = [(255, 255, 255), (232, 69, 55), (253, 190, 83), (209, 118, 208)]
        for i in range(8 * (n - 1)):
            x, y = rnd.randint(1, W - 2), rnd.randint(24, H - 2)
            put(x, y, cols[i % len(cols)])
    # oiseaux dans le ciel (1 par étape)
    birds = [(40, 9), (52, 6), (75, 12), (20, 13), (88, 4)]
    for (x, y) in birds[:n]:
        bird = (63, 38, 49)
        put(x - 1, y - 1, bird); put(x, y, bird); put(x + 1, y - 1, bird); put(x - 2, y - 1, bird) if False else None
    # papillons (étapes 3+)
    if n >= 3:
        for (x, y) in ((48, 30), (18, 40), (82, 35))[: n - 2]:
            put(x, y, (232, 69, 55)); put(x + 1, y, (253, 190, 83))
    return frame_border(im)


def vignette_section():
    add('story.box', story_box())
    for n in range(6):
        add(f'valley.stage.{n}', valley_stage(n))


# ===========================================================================
# 6. Icônes de l'interface, ciel, album

ICON_VALLEY = """
................
..........ddd...
........ddGGGd..
.......dGjjGGd..
......dGjGGGGd..
......dGjGdGd...
......dGGdGGd...
.......ddGGd....
....N.d.ddd.....
...NN.d.........
.yNwN.d.........
..NNNNd.........
...NNNNN........
....N.N.........
................
................
"""

ICON_SIGNS = """
................
.....AAAAAA.....
...AAkkkkkkAA...
..AkkkkkkddkkA..
..AkkkkkdGjdkA..
.AkkkddkdGdkkkA.
.AkkdGjddkkkkkA.
.AkkddGddkkkkkA.
.AkkkkddkkkkkkA.
.AkkkkkdkkkkkkA.
..AkkkkdkkkkkA..
..AkknnnnnnkkA..
...AAnnnnnnAA...
.....AAAAAA.....
................
................
"""

TRAIT_ICONS = {
    'early': """
................
.......ss.......
.....sWWWWs.....
....sWWWWWWs....
...sWWWNWWWWs...
...sWWWNWWWWs...
..sWWWWNWWWWWs..
..sWWWWNNNNWWs..
..sWWWWWWWWWWs..
...sWWWWWWWWs...
...sWWWWWWWWs...
....sWWWWWWs....
.....ssssss.....
....SS....SS....
................
................
""",
    'dry': """
................
.......c........
......cc......q.
.....cvcC....qE.
.....cvcC...qE..
....cvccCC.qE...
....cvcCCCqE....
...cvccCCqEC....
...cccCCqECC....
...ccCCqECCC....
....cCqECCC.....
....CqECCCC.....
...qE.CCCC......
..qE............
................
................
""",
    'hardy': """
................
.......w........
.....w.w.w......
......www.......
..w...cwc...w...
...w..cwc..w....
.wwwwwcwcwwwww..
...cccwwwccc....
.wwwwwcwcwwwww..
...w..cwc..w....
..w...cwc...w...
......www.......
.....w.w.w......
.......w........
................
................
""",
    'fine': """
................
.......y........
.......y........
......yiy.......
......yiy.......
.yyyyyiiiyyyyy..
..YyiiiiiiiyY...
...YyiiiiiyY....
....YyiiiyY.....
....YyiYiyY.....
...YyiY.YiyY....
...YyY...YyY....
..YYY.....YYY...
................
................
................
""",
    'tasty': """
................
................
...EEE...EEE....
..EppEE.EEEEE...
.EpwpEEEEEEEqE..
.EppEEEEEEEEqE..
.EEEEEEEEEEqqE..
..EEEEEEEEEqE...
...EEEEEEEqE....
....EEEEEqE.....
.....EEEqE......
......EqE.......
.......E........
................
................
................
""",
    'bee': """
................
......WW..WW....
.....WccWWccW...
.....WccWWccW...
......WWWWWW....
....&yyy&&yyw...
...&&yyy&&yyww..
..&w&yyy&&yyww..
..&&&yyy&&yyw...
...&&YYY&&YY....
....&.&..&.&....
................
................
................
................
................
""",
    'giant': """
................
.......G........
......GjG.......
.....GjjGG......
....GjjGGGG.....
...GjjGGGGdd....
..GjjGGGGGddd...
..dGGGGGGddd7...
...dGGGGddd7....
....dGGddd7.....
.....dGdd7......
......dd7.......
.......7........
................
................
................
""",
}


def icon_nature(kind):
    if kind in ('nestbox', 'owlbox', 'woodpile'):
        return get(f'nature.{kind}')
    if kind == 'reeds':
        return get('nature.reeds.1')
    if kind == 'hedge':
        g = Grid(16, 16)
        for (cx, cy, r) in ((4.5, 9.5, 3.6), (11.5, 9.5, 3.6), (8, 6.5, 4.0), (8, 11, 3.6)):
            g.ball(cx, cy, r, r * 0.9, 'jGd', ring='d')
        for (x, y) in ((5, 7), (10, 5), (12, 10), (7, 11)):
            g.set(x, y, 'w')
        g.set(8, 8, 'E')
        g.rect(4, 14, 11, 14, 'n')
        return icon(g.rows())
    if kind == 'strip':
        g = Grid(16, 16)
        for (cx, cy, r) in ((3.5, 11.5, 3.0), (8, 11, 3.4), (12.5, 11.5, 3.0)):
            g.ball(cx, cy, r, r * 0.85, 'jGd', ring='d')
        for (x, y, c) in ((3, 5, 'E'), (8, 3, ':'), (12, 6, 'E'), (6, 8, 'w'), (10, 8, ':')):
            g.line(x, y + 2, x, 10, 'd')
            g.stamp([f'.{c}.', f'{c}y{c}', f'.{c}.'], x - 1, y - 1)
        return icon(g.rows())
    if kind == 'insectHotel':
        return icon("""
................
.......NN.......
......NnnN......
.....NnnnnN.....
....NnnnnnnN....
...NNNNNNNNNN...
....BBBBBBBB....
....BkAkABRB....
....BAkAkBRB....
....BBBBBBBB....
....BnoNByYB....
....BonoBYyB....
....BBBBBBBB....
.....UU..UU.....
................
................
""")
    if kind == 'loneTree':
        g = Grid(16, 16)
        g.rect(7, 10, 8, 14, 'B')
        g.set(8, 10, 'N'); g.set(8, 11, 'N'); g.set(8, 12, 'N'); g.set(8, 13, 'N'); g.set(8, 14, 'N')
        for (cx, cy, r) in ((4.5, 7, 3.2), (11.5, 7, 3.2), (8, 4, 3.6), (8, 8.5, 3.4)):
            g.ball(cx, cy, r, r * 0.9, 'GdD' if False else 'jGd', ring='d')
        g.stamp(['N', 'b'], 11, 8)
        g.rect(4, 15, 11, 15, 'd')
        return icon(g.rows())
    if kind == 'fallow':
        g = Grid(16, 16)
        g.rect(1, 6, 14, 14, 'n')
        for y in (8, 11, 14):
            g.rect(1, y, 14, y, 'N')
        for (x, y) in ((3, 5), (8, 3), (12, 6), (5, 9), (10, 10)):
            g.stamp(['.E.', 'EpE', '.d.'], x - 1, y - 1)
        return icon(g.rows())
    raise KeyError(kind)


NATURE_KINDS = ['hedge', 'strip', 'nestbox', 'owlbox', 'woodpile', 'insectHotel', 'loneTree', 'reeds', 'fallow']

FX_BIRDS = ["""
................
................
.AA.A...........
...A............
................
.......AA.A.....
.........A......
................
................
...AA.A.........
.....A..........
................
................
................
................
................
""", """
................
................
................
.AAAAA..........
................
................
......AAAAA.....
................
................
................
..AAAAA.........
................
................
................
................
................
"""]

FX_BUTTERFLY = ["""
........
.Ey..yE.
.EEAAEE.
..EAAE..
.EyAAyE.
..E..E..
........
........
""", """
........
...EE...
...EE...
...yy...
...AA...
...AA...
........
........
"""]

ALBUM_HEIRLOOMS = """
................
......E..E......
.......EE.......
.....((EE((.....
....((((((((....
....)(((((((....
....)((NNN((....
....)(NbbbN(....
....)(Nbkbn(....
....)((Nnn((....
....)(((d(((....
....)((dGd((....
....))))))))....
................
................
................
"""

ALBUM_WILDLIFE = """
................
................
...NN...........
..NHHN.NN.......
..NHHNNHHN......
...NN.NHHN......
.......NN.NN....
..........NHN...
....NNNN..NHN...
...NHHHHN..N....
..NHHHHHHN......
..NHHHHHHN......
...NHHHHN.......
....NNNN........
................
................
"""


def icons_section():
    add('icon.valley', icon(ICON_VALLEY))
    add('icon.signs', icon(ICON_SIGNS))
    for tid, src in TRAIT_ICONS.items():
        add(f'icon.trait.{tid}', icon(src))
    for kind in NATURE_KINDS:
        add(f'icon.nature.{kind}', icon_nature(kind))
    for i, src in enumerate(FX_BIRDS):
        add('fx.birds' + ('.1' if i else ''), art(rows_of(src), outline=0, w=16, h=16))
    for i, src in enumerate(FX_BUTTERFLY):
        add8('fx.butterfly' + ('.1' if i else ''), art(rows_of(src), outline=0, w=8, h=8))
    add('album.page.heirlooms', icon(ALBUM_HEIRLOOMS))
    add('album.page.wildlife', icon(ALBUM_WILDLIFE))


# ===========================================================================
# 7. Décors de l'album et succès

SEED_CABINET = """
................
................
...NNNNNNNNNN...
...NbbbbbbbbN...
...NBBBBBBBBN...
...NbkkbbkkbN...
...NbwWbbwWbN...
...NbbNbbNbbN...
...NBBBBBBBBN...
...NbkkbbkkbN...
...NbwWbbwWbN...
...NbbNbbNbbN...
...NBBBBBBBBN...
...NNNNNNNNNN...
....NN....NN....
................
"""

NESTBOX_PAINTED = """
................
.......AA.......
......AqqA......
.....AqRRqA.....
....AqRRRRqA....
...AqqqqqqqqA...
....!!!!!!!@....
....!K!!!y!@....
....!!!AA!!@....
....!y!AA!K@....
....!!!!!!!@....
....!!G!w!!@....
....@@@@@@@@....
.......VU.......
.......VU.......
......VVUU......
"""


def linden():
    """Le tilleul de la vallée : grand tilleul en fleurs (bouquets jaune pâle), banc à son pied."""
    g = Grid(32, 32)
    oak_trunk(g, 14, 18, 28, 4)
    g.stamp(['n......N', '.n....N.'], 12, 28)
    clumps = [(8, 11, 5.5), (24, 11, 5.5), (16, 6, 6.5), (10, 17, 5.0), (22, 17, 5.0), (16, 13, 6.0), (16, 2.8, 3.2)]
    oak_crown(g, clumps, 'jGd', ring='d')
    for (x, y) in ((7, 9), (12, 5), (19, 4), (24, 9), (10, 15), (16, 11), (21, 15), (26, 13), (14, 18), (5, 13),
                   (18, 8), (13, 12)):
        g.set(x, y, '1')
        g.set(x + 1, y, '2')
    # banc de bois au pied
    g.rect(4, 25, 12, 25, 'b')
    g.rect(4, 26, 12, 26, 'B')
    g.rect(4, 22, 12, 23, 'b')
    g.rect(4, 23, 12, 23, 'B')
    g.rect(5, 27, 5, 29, 'N'); g.rect(11, 27, 11, 29, 'N')
    g.rect(5, 24, 5, 24, 'N'); g.rect(11, 24, 11, 24, 'N')
    for x in range(3, 29):   # herbe au pied
        if g.get(x, 30) == '.':
            g.set(x, 30, 'd' if x % 3 else 'G')
    return art(g.rows(), outline=1, w=32, h=32)


def decor_section():
    add('decor.seed.cabinet', icon(SEED_CABINET))
    add('decor.nestbox.painted', art(rows_of(NESTBOX_PAINTED), outline=1, w=16, h=16))
    add('decor.valley.linden', linden())


ACH_MOTIF = {
    'valleyBox': ['@@@@@@', '@!K!w@', '@####@', '!!y!!!', '!K!!L!', '@@@@@@'],
    'firstSaved': ['..dd..', '.dGjd.', '..dd..', '((E(((', '((N(((', ')))))'],
    'seedKeeper': ['.ssss.', 'sWWWWs', 'syYyYs', 'sYyYys', 'syYyYs', '.ssss.'],
    'firstNeighbour': ['..NNN.', '.NHNHN', 'kNHNHN', 'AkkNHN', '.kkkk.', '.N..N.'],
    'welcomingFarm': ['..NN..', '.NnnN.', 'NNNNNN', '.bbbb.', '.bAAb.', '..VV..'],
    'valleySings': ['..NNNN', '..NNNN', '..N..N', '..N..N', 'NN.NN.', 'NN.NN.'],
    'seedHands': ['..Y.y.', '.y..Y.', 'f.....', 'ff..ff', 'fffff.', '.fff..'],
}


def ach_icon(motif):
    """Médaillon doré (comme generate-career.py / generate-lot4.py) et motif au centre."""
    g = Grid(16, 16)
    for (x, y) in gc.ellipse_cells(8, 8, 6.4, 6.4):
        g.set(x, y, 'y')
    for (x, y) in gc.ellipse_cells(8, 8, 5.0, 5.0):
        g.set(x, y, 'k')
    for (x, y) in gc.ellipse_cells(8, 8, 6.4, 6.4):
        if x > 8 and y > 8 and g.get(x, y) == 'y':
            g.set(x, y, 'Y')
    h = len(motif)
    w = max(len(r) for r in motif)
    g.stamp(motif, 8 - w // 2, 8 - h // 2 + (1 if h < 6 else 0))
    return art(g.rows(), outline=2, w=16, h=16)


def ach_section():
    for aid, motif in ACH_MOTIF.items():
        im = ach_icon(motif)
        add(f'icon.ach.{aid}', im)
        add(f'icon.ach.{aid}.locked', gc.gray(im))


# ===========================================================================
# Assemblage

SECTIONS = [heirloom_section, wild_section, hints_section, hedge_section, strip_section, nature_objects_section,
            oak_section, fallow_section, edge_section, small_items_section, vignette_section, icons_section,
            decor_section, ach_section]


def pack():
    """Premier emplacement libre (lecture ligne par ligne), les grands sprites d'abord (ordre déterministe).
    Les sprites 8 × 8 sont regroupés par quatre dans des tuiles placées à la fin."""
    used = set()
    pos = {}
    items = list(ENTRIES)
    quads = []
    for i in range(0, len(SMALL), 4):
        quad = SMALL[i:i + 4]
        im = img(16, 16)
        for k, (n, s) in enumerate(quad):
            im.alpha_composite(s, ((k % 2) * 8, (k // 2) * 8))
        key = f'__quad{i // 4}'
        quads.append((key, quad))
        items.append((key, im))
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
    small_pos = {}
    for key, quad in quads:
        c, r, _, _ = pos[key]
        for k, (n, _) in enumerate(quad):
            small_pos[n] = (c + (k % 2) * 0.5, r + (k // 2) * 0.5, 0.5, 0.5)
    return items, pos, small_pos, rows


def _num(v):
    return str(int(v)) if float(v).is_integer() else str(v)


def js_entry(c, r, w, h):
    return f"{{ sheet: '{SHEET}', col: {_num(c)}, row: {_num(r)}" + \
        (f', w: {_num(w)}, h: {_num(h)}' if (w, h) != (1, 1) else '') + ' }'


HEADER = """// Lot V1 de La Vallée vivante (planche « valley1 », assets/sprites/valley1.png) : « La boîte en fer », style Kenney.
// Variétés : heirloom.<id>.icon (12), heirloom.<id>.3 / .4 (11 cultures ; .0 à .3 et .dead manquants = alias de la
// culture de base, posés ci-dessous), heirloom.rougeVifDEtampes.giant (32 × 32), heirloom.calvilleBlanc.fruit (à poser
// par-dessus tree.apple.*) ; habitants wild.<id>[.1] (regard vers la GAUCHE ; .1 = seconde image), indices
// wild.hint.<tracks|feather|eggs|nuts|note> ; aménagements : nature.hedge.<saison>.<top|mid|bot> (haie verticale :
// haut, milieu répétable, bas), nature.strip.<saison>[.1] (répétable en largeur), nature.nestbox / owlbox / woodpile,
// nature.insectHotel (16 × 32), nature.reeds[.1|.2], nature.oak.sapling / young (16 × 32) / <saison> (32 × 48),
// nature.fallow.<saison> (32 × 32, sur la terre de la parcelle), nature.edge.flowers.<0..2> ; hedgefind.<id>,
// valley.box[.open], valley.label (8 × 8 : col/row demi-entiers, w = h = 0.5), seedpack.heirloom, story.box
// (48 × 32), valley.stage.<0..5> (96 × 48) ; icon.valley, icon.signs, icon.trait.<id>, icon.nature.<kind>,
// fx.birds[.1], fx.butterfly[.1] (8 × 8), album.page.heirlooms / wildlife, decor.seed.cabinet,
// decor.nestbox.painted, decor.valley.linden (32 × 32), icon.ach.<id>[.locked].
// Ajoutés à SPRITES ici même (Object.assign), après sa définition."""

TRAILER = """// Étapes des variétés que la planche ne redessine pas (0 à 2, le plant 3 quand la variété ne le change pas, le fané) :
// celles de la culture de base. Le pommier (calvilleBlanc) garde tree.apple.* et y pose heirloom.calvilleBlanc.fruit.
const HEIRLOOM_CROPS = {
%s
};
for (const [id, cropId] of Object.entries(HEIRLOOM_CROPS)) {
  for (const st of ['0', '1', '2', '3', 'dead']) {
    const name = `heirloom.${id}.${st}`;
    if (!SPRITES[name] && SPRITES[`crop.${cropId}.${st}`]) SPRITES[name] = SPRITES[`crop.${cropId}.${st}`];
  }
}"""


def existing_names(src):
    """Noms de sprites déclarés ailleurs dans atlas.js (hors bloc valley1) : clés littérales et alias écrits en dur."""
    src = re.sub(r'// <valley1:auto>\n.*?// </valley1:auto>', '', src, flags=re.S)
    names = set(re.findall(r"^\s*'([\w.]+)':", src, re.M))
    names |= set(re.findall(r"SPRITES\['([\w.]+)'\]\s*=", src))
    return names


def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument('--contact', help='dossier où écrire des planches de contrôle ×6')
    args = ap.parse_args()
    for fn in SECTIONS:
        fn()
    items, pos, small_pos, rows = pack()
    sheet = img(SHEET_COLS * T, rows * T)
    for name, im in items:
        c, r, w, h = pos[name]
        sheet.alpha_composite(im, (c * T, r * T))
    atlas = ROOT / 'src' / 'render' / 'atlas.js'
    src = atlas.read_text()
    # aucun heurt avec les autres planches
    mine = [n for n, _ in ENTRIES + SMALL] + [n for n, _ in ALIASES]
    clash = sorted(set(mine) & existing_names(src))
    if clash:
        raise SystemExit('noms déjà pris dans atlas.js : ' + ', '.join(clash))
    sheet.save(HERE / 'valley1.png', optimize=True)
    allpos = dict(pos)
    allpos.update(small_pos)
    lines = [HEADER, '// Généré par assets/sprites/generate-valley1.py — ne pas modifier à la main.', 'const valley1 = {']
    for name, _ in ENTRIES + SMALL:
        lines.append(f"  '{name}': {js_entry(*allpos[name])},")
    for name, target in ALIASES:
        lines.append(f"  '{name}': {js_entry(*allpos[target])},")
    lines.append('};')
    lines.append('Object.assign(SPRITES, valley1);')
    pairs = [f"{vid}: '{cid}'," for vid, cid in VARIETIES.items() if cid != 'apple']
    crops = '\n'.join('  ' + ' '.join(pairs[i:i + 4]) for i in range(0, len(pairs), 4))
    lines.append(TRAILER % crops)
    block = '\n'.join(lines)
    if "  valley1: 'assets/sprites/valley1.png'," not in src:   # planche déclarée dans SHEETS
        src = src.replace("  lot4: 'assets/sprites/lot4.png',\n",
                          "  lot4: 'assets/sprites/lot4.png',\n  valley1: 'assets/sprites/valley1.png',\n", 1)
    if '// <valley1:auto>' not in src:
        if '// </lot4:auto>\n' not in src:
            raise SystemExit('marqueurs // <valley1:auto> (ou // </lot4:auto>) absents de src/render/atlas.js')
        src = src.replace('// </lot4:auto>\n', '// </lot4:auto>\n\n// <valley1:auto>\n// </valley1:auto>\n', 1)
    new = re.sub(r'(// <valley1:auto>\n).*?(// </valley1:auto>)', lambda m: m.group(1) + block + '\n' + m.group(2),
                 src, flags=re.S)
    atlas.write_text(new)
    n = len(ENTRIES) + len(SMALL)
    print(f'écrit {HERE / "valley1.png"} ({SHEET_COLS} × {rows} tuiles, {n} sprites, {len(ALIASES)} alias)')
    if args.contact:
        contact_sheets(Path(args.contact))


def group_of(name):
    if name.startswith('heirloom.'):
        return 'heirlooms'
    if name.startswith('wild.'):
        return 'wildlife'
    if name.startswith(('nature.', 'hedgefind.')):
        return 'nature'
    if name.startswith(('story.', 'valley.stage.')):
        return 'vignettes'
    if name.startswith(('decor.', 'valley.', 'seedpack.')):
        return 'decor'
    return 'icons'


def contact_sheets(folder, scale=6):
    """Planches de contrôle : chaque groupe à ×scale, à côté d'originaux (Kenney, v3, lot 2, lot 4)."""
    folder.mkdir(parents=True, exist_ok=True)
    refs = {
        'heirlooms': [tile(6, 0), tile(6, 3), V3S['crop.pumpkin.4'], V3S['crop.pumpkin.icon'], V3S['tree.apple.summer.ripe']],
        'wildlife': [L2S['hedgehog'], L2S['fox'], L4S['bird.robin'], L4S['bird.tit'] if 'bird.tit' in L4S else tile(0, 9)],
        'nature': [V3S['deco.hedge.v.top'], V3S['deco.hedge.v.mid'], V3S['deco.hedge.v.bottom'], V3S['tree.apple.summer'],
                   L4S['decor.woodpile']],
        'vignettes': [L4S['story.vignette'] if 'story.vignette' in L4S else tile(0, 9)],
        'decor': [L4S['seedpack.generic'], L3S['item.heirloom'], V3S['deco.scarecrow']],
        'icons': [CAS['icon.ach.tractor'], CAS['icon.ach.tractor.locked'], L4S['icon.seedbank'], L4S['album.page.garden']],
    }
    groups = {k: [] for k in refs}
    for name, im in ENTRIES:
        groups[group_of(name)].append(im)
    for name, im in SMALL:
        groups['icons'].append(im)
    for key, ims in groups.items():
        for bgname, bg in (('', (132, 198, 105, 255)), ('-parchment', (255, 241, 210, 255)), ('-soil', (189, 108, 74, 255))):
            if bgname == '-parchment' and key not in ('icons', 'heirlooms', 'decor'):
                continue
            if bgname == '-soil' and key not in ('heirlooms', 'nature'):
                continue
            W = 1600
            x = y = rowh = 0
            placed = []
            for im in refs[key] + [None] + ims:
                if im is None:
                    x, y, rowh = 0, y + rowh + 6, 0
                    continue
                w, h = im.width * scale + 8, im.height * scale + 8
                if x + w > W:
                    x, y, rowh = 0, y + rowh, 0
                placed.append((x, y, im))
                x += w
                rowh = max(rowh, h)
            out = Image.new('RGBA', (W, y + rowh), bg)
            for (x, y, im) in placed:
                out.alpha_composite(im.resize((im.width * scale, im.height * scale), Image.NEAREST), (x + 4, y + 4))
            out.save(folder / f'valley1-art-contact-{key}{bgname}.png')


if __name__ == '__main__':
    main()
