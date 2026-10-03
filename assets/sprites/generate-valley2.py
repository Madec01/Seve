#!/usr/bin/env python3
"""Génère assets/sprites/valley2.png : sprites du lot V2 « Le troc et les croisements » de La Vallée vivante
(style Kenney, CC0).

Contenu (voir docs/ARCHITECTURE.md, « Vallée vivante — contrats du lot V2 », tableau des sprites, et docs/VALLEE.md
§ 16) :
  - variétés du village : heirloom.<id>.icon (12), heirloom.<id>.4 (11 cultures ; .3 quand la teinte change le plant),
    heirloom.apiEtoile.fruit (petites pommes étoilées à poser sur tree.apple.*) ;
  - variétés croisées : heirloom.<crossId>.icon (petit sceau doré en bas à droite) et .4 (+ .3 si changé), 11 cultures ;
  - géants (32 × 32) : heirloom.coeurDeBoeufDesVertus.giant, heirloom.crossCabbage.giant, heirloom.crossPumpkin.giant ;
  - Grainothèque : library.site, library.1 … library.5 (32 × 32), library.window ;
  - troc.pin, seedpack.village, seedpack.cross, jar.empty, jar.glass, shelf.wood ;
  - habitants wild.<wildBee|blackbird|lizard|bat>[.1] (regard vers la GAUCHE), indices wild.hint.<mud|tail|moon> ;
  - nature.batbox, icon.nature.batbox, icon.trait.scented, icon.library, icon.swap, icon.cross ;
  - fx.pollen[.1] (8 × 8) ; vignettes story.library, story.cross, story.library5 (48 × 32) ;
  - onglets album.page.swaps / crosses / wildlife2 ; décors decor.swap.basket, decor.cross.sign, decor.lizard.wall ;
  - succès icon.ach.<id> (+ .locked grisée), même médaillon que career.png / valley1.png.

Même méthode que generate-valley1.py (dont il reprend les outils) : palette Kenney, contour sombre (63, 38, 49),
lumière en haut à gauche ; 1 px de contour pour les icônes, les bêtes et les petits objets, 2 px pour les grands.
Les variétés reprennent les tuiles des cultures de base (Tiny Farm, v3.png) recolorées pixel à pixel, avec des
retouches de forme propres à chaque variété.

Le script :
  1. dessine chaque sprite ;
  2. les range dans la planche (placement automatique, déterministe, 16 tuiles de large) ;
  3. écrit assets/sprites/valley2.png ;
  4. réécrit, dans src/render/atlas.js, le bloc compris entre « // <valley2:auto> » et « // </valley2:auto> »
     (le crée juste après « // </valley1:auto> » s'il n'existe pas encore) et déclare la planche dans SHEETS ;
  5. vérifie qu'aucun nom ne heurte un sprite des autres planches.

Relancer :  python3 assets/sprites/generate-valley2.py   (nécessite Pillow)
Planches de contrôle (×6) : python3 assets/sprites/generate-valley2.py --contact DOSSIER
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


v1 = _load('gen_valley1', HERE / 'generate-valley1.py')
g2, g3, gc = v1.g2, v1.g3, v1.gc

T = 16
SHEET_COLS = 16
SHEET = 'valley2'
OUT = v1.OUT
img, tile, flip = g3.img, g3.tile, g3.flip
Grid = v1.Grid
V3S, L4S, L2S = v1.V3S, v1.L4S, v1.L2S
BASE = v1.BASE
ellipse = v1.ellipse
rows_of, over, shift, frame_border, lerp = v1.rows_of, v1.over, v1.shift, v1.frame_border, v1.lerp

# Palette : celle du V1, et quelques teintes du V2.
PAL = dict(v1.PAL)
PAL.update({
    # bleu d'Artois (peau, chair)
    '8': (150, 160, 232),
    '9': (92, 98, 178),
    '0': (60, 62, 128),
    # saumon (galeuse d'Eysines)
    't': (238, 146, 100),
    '"': (250, 192, 150),
    '>': (184, 92, 66),
    # chair bleu clair (pomme de terre coupée)
    '£': (196, 204, 255),
    # velours rouge (tournesol), rouge très vif (Moutot)
    '`': (150, 30, 48),
    '^': (238, 44, 56),
    # lézard gris-brun
    '{': (168, 152, 120),
    '}': (112, 98, 78),
    # nuit (ciel du soir)
    '<': (52, 60, 104),
})
K = dict(PAL)


def art(rows, outline=2, w=None, h=None, pal=None):
    return g3.art(rows, outline=outline, pal=pal or PAL, w=w, h=h)


def icon(src, pal=None, w=16, h=16):
    rows = rows_of(src) if isinstance(src, str) else src
    assert len(rows) <= h and all(len(r) <= w for r in rows), src
    return art(rows, outline=1, w=w, h=h, pal=pal)


def recolor(im, mapping, box=None):
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


def sparkle(im, x, y, big=False):
    return g2.mini_sparkle(im, x, y, big=big)


def glow(im, cx, cy, r, color=(255, 226, 140), alpha=120):
    return g2.glow(im, cx, cy, r, color=color, alpha=alpha)


def setpx(im, pts, c, a=255):
    px = im.load()
    col = PAL[c] if isinstance(c, str) else c
    for (x, y) in pts:
        if 0 <= x < im.width and 0 <= y < im.height:
            px[x, y] = col + (a,)
    return im


# ---------------------------------------------------------------------------
# Registre : nom → image

ENTRIES = []
SMALL = []
ALIASES = []
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


def get(name):
    for n, im in ENTRIES + SMALL:
        if n == name:
            return im
    raise KeyError(name)


# ===========================================================================
# 1. Variétés du village et variétés croisées

VILLAGE = {
    'carotteViolette': 'carrot', 'marteauDesVertus': 'turnip', 'barbuDuRoussillon': 'wheat',
    'coeurDeBoeufDesVertus': 'cabbage', 'noireDeCrimee': 'tomato', 'blancDesLandes': 'corn',
    'veloursRouge': 'sunflower', 'bleueDArtois': 'potato', 'madameMoutot': 'strawberry',
    'blancheDeVirginie': 'zucchini', 'galeuseDEysines': 'pumpkin', 'apiEtoile': 'apple',
}
CROSSES = {
    'crossCarrot': 'carrot', 'crossTurnip': 'turnip', 'crossWheat': 'wheat', 'crossCabbage': 'cabbage',
    'crossTomato': 'tomato', 'crossCorn': 'corn', 'crossSunflower': 'sunflower', 'crossPotato': 'potato',
    'crossStrawberry': 'strawberry', 'crossZucchini': 'zucchini', 'crossPumpkin': 'pumpkin',
}

Y_, y_, o_, i_ = K['Y'], K['y'], K['o'], K['i']
g_, G_, d_ = K['g'], K['G'], K['d']
R_, r_, q_, p_ = K['R'], K['r'], K['q'], K['p']

SALMON = {Y_: K['t'], y_: K['"'], o_: K['>'], i_: (255, 230, 206)}
REDVIF = {Y_: (222, 52, 40), o_: (150, 30, 30), y_: (246, 104, 72), i_: (255, 170, 130)}

TINTS = {
    # village
    'carotteViolette': {Y_: K['|'], o_: K['5'], y_: K['Y']},
    'marteauDesVertus': {K['P']: K['/'], K['Q']: K['|'], K['l']: K['w']},
    'barbuDuRoussillon': {y_: (246, 214, 112), Y_: (206, 154, 62), i_: (255, 236, 170)},
    'coeurDeBoeufDesVertus': {g_: (220, 240, 160), G_: (172, 214, 116), d_: (108, 170, 84)},
    'noireDeCrimee': {R_: (98, 54, 56), r_: (150, 88, 76), q_: (62, 34, 42), p_: (170, 104, 92)},
    'blancDesLandes': {y_: (252, 246, 218), Y_: (226, 214, 170), i_: (255, 255, 240)},
    'veloursRouge': {y_: (196, 52, 58), Y_: (140, 30, 42), i_: (232, 98, 92), K['n']: K['N']},
    'bleueDArtois': {K['b']: K['8'], K['B']: K['9'], K['k']: (190, 198, 244), K['n']: K['0']},
    'madameMoutot': {R_: K['^'], r_: (255, 120, 108), q_: (168, 20, 40)},
    'blancheDeVirginie': {G_: (206, 222, 170), d_: (150, 176, 116), g_: (236, 244, 214)},
    'galeuseDEysines': SALMON,
    # croisées
    'crossCarrot': {y_: K['|']},
    'crossTurnip': {K['P']: y_, K['Q']: Y_, K['l']: (255, 238, 176)},
    'crossWheat': {y_: K['$'], Y_: K['%'], i_: (244, 176, 120)},
    'crossCabbage': {g_: (190, 226, 130), G_: (120, 182, 92), d_: K['7']},
    'crossTomato': {R_: (74, 40, 48), r_: (124, 70, 66), q_: (44, 26, 34), p_: (150, 86, 80)},
    'crossCorn': {y_: (250, 240, 210), Y_: K['$']},
    'crossSunflower': {K['n']: K['`'], y_: (255, 212, 60), Y_: (232, 150, 24), i_: (255, 240, 150)},
    'crossPotato': {K['b']: K['/'], K['B']: K['9'], K['k']: K['8'], K['n']: K['5']},
    'crossStrawberry': {R_: (232, 30, 50), r_: (255, 96, 96), q_: (150, 14, 36)},
    'crossZucchini': {G_: (176, 210, 132), d_: (110, 160, 90), g_: (220, 238, 180)},
    'crossPumpkin': REDVIF,
}


def fruit_px(p):
    return v1.is_fruit_px(p, None)


def speckle(im, mapping, step=3, phase=0, test=None):
    """Petites bosses / marbrures : un pixel sur `step` (en quinconce) des couleurs de `mapping` change."""
    im = im.copy()
    px = im.load()
    m = {k: (PAL[v] if isinstance(v, str) else v) for k, v in mapping.items()}
    for y in range(im.height):
        for x in range(im.width):
            p = px[x, y]
            if p[3] and p[:3] in m and (x + 2 * y + phase) % step == 0 and (test is None or test(x, y)):
                px[x, y] = m[p[:3]] + (255,)
    return im


def shoulders(im, color, depth=2, colors=None):
    """Épaules vertes d'une tomate : les `depth` premiers pixels « fruit » de chaque colonne."""
    im = im.copy()
    px = im.load()
    for x in range(im.width):
        n = 0
        for y in range(im.height):
            p = px[x, y]
            if p[3] and p[:3] in colors:
                px[x, y] = color + (255,)
                n += 1
                if n >= depth:
                    break
    return im


def beards(im, colors, color, length=2):
    """Barbes du blé : au-dessus du premier pixel d'épi de chaque colonne, des soies fines vers le haut."""
    im = im.copy()
    px = im.load()
    src = im.copy().load()
    for x in range(1, im.width - 1, 2):
        for y in range(im.height):
            p = src[x, y]
            if p[3] and p[:3] in colors:
                for k in range(1, length + 1):
                    yy = y - 1 - k
                    xx = x + (k // 2) * (1 if x % 4 == 1 else -1)
                    if 0 <= yy and 0 <= xx < im.width and not src[xx, yy][3]:
                        px[xx, yy] = color + (255,)
                break
    return im


def seal(im):
    """Petit sceau doré des variétés croisées, en bas à droite (7 × 7, rond, contour sombre)."""
    im = im.copy()
    rows = ['..AAA..', '.AiyyA.', 'AiyyyYA', 'AyyiYYA', 'AyYYYoA', '.AYooA.', '..AAA..']
    px = im.load()
    for y, line in enumerate(rows):
        for x, ch in enumerate(line):
            if ch != '.':
                px[9 + x, 9 + y] = (OUT if ch == 'A' else PAL[ch]) + (255,)
    return im


# --- dessins propres à certaines variétés --------------------------------

def long_turnip_icon(top, mid, flesh, shade):
    """Navet long (Vertus Marteau) : racine effilée, collet coloré, fanes."""
    g = Grid(16, 16)
    g.stamp(['.d..G.', 'dGd.Gd', '.dGdG.', '..dGd.'], 5, 0)
    cells = {}
    for y in range(4, 16):
        t = (y - 4) / 11
        half = 3.2 * (1 - t) ** 0.8 + 0.3
        for x in range(16):
            dx = x + 0.5 - (8 + t * 1.5)
            if abs(dx) <= half:
                c = flesh
                if y <= 5:
                    c = top
                elif y <= 6:
                    c = mid
                elif dx > half * 0.35:
                    c = shade
                cells[(x, y)] = c
    g.layer(cells)
    g.set(6, 8, 'w')
    g.set(6, 9, 'w')
    return icon(g.rows())


def pointed_cabbage_icon(ramp, blisters=False):
    """Chou pointu (cœur de bœuf) : pomme en forme de goutte, feuilles ouvertes au pied."""
    g = Grid(16, 16)
    g.ball(4, 12, 3.6, 3.0, ramp[1:], ring='A')
    g.ball(12, 12, 3.6, 3.0, ramp[1:], ring='A')
    cells = {}
    for y in range(1, 15):
        t = (y - 1) / 13
        half = 5.2 * math.sin(math.pi * min(1.0, t * 0.85 + 0.08)) ** 0.9
        for x in range(16):
            nx = (x + 0.5 - 8) / max(half, 0.1)
            if abs(nx) <= 1:
                ny = (t - 0.55) * 2
                cells[(x, y)] = ramp[g2.shade_index((nx, ny), ramp)]
    g.layer(cells)
    for y in range(4, 14):
        if g.get(8, y) not in '.A':
            g.set(8, y, ramp[1])
    for (x, y) in ((6, 6), (10, 7), (6, 10), (10, 11)):
        if g.get(x, y) not in '.A':
            g.set(x, y, ramp[-1])
    if blisters:
        for (x, y) in ((5, 8), (7, 5), (9, 9), (11, 10), (7, 12), (10, 4)):
            if g.get(x, y) not in '.A':
                g.set(x, y, 'g')
    g.set(6, 4, 'w')
    return icon(g.rows())


def black_tomato_icon(base, tint):
    im = recolor(base, tint)
    dark = {tint[R_]: tint[q_], tint[r_]: tint[R_]}
    v1.ribs(im, (5, 8, 11), dark, lambda c: True, y0=5, y1=11)
    return shoulders(im, (110, 122, 62), depth=2, colors={tint[R_], tint[r_], tint[q_], tint[p_]})


def corn_icon(base, light, dark, mixed=False):
    im = recolor(base, {y_: light, Y_: dark})
    if mixed:   # grains roux et blancs mêlés
        im = speckle(im, {light: K['$'], dark: (250, 240, 210)}, step=3)
    return im


def round_strawberry_icon(tint):
    """Grosse fraise ronde (Madame Moutot)."""
    g = Grid(16, 16)
    g.ball(8, 9.5, 6.0, 5.6, 'rRRq', ring='A')
    for (x, y) in ((5, 8), (8, 7), (11, 8), (6, 11), (9, 10), (11, 12), (8, 13), (4, 10)):
        if g.get(x, y) not in '.A':
            g.set(x, y, 'i')
    g.stamp_ring(['G.d.G', '.GdG.', 'dGGGd'], 6, 2)
    g.stamp(['.N', 'N.'], 8, 0)
    g.set(5, 6, 'w')
    return recolor(icon(g.rows()), tint)


def cone_strawberry_icon(tint):
    """Petite fraise conique très rouge (croisée)."""
    g = Grid(16, 16)
    cells = {}
    for y in range(5, 15):
        t = (y - 5) / 9
        half = 4.6 * (1 - t) ** 0.7 + 0.4
        for x in range(16):
            nx = (x + 0.5 - 8) / half
            if abs(nx) <= 1:
                cells[(x, y)] = 'rRRq'[g2.shade_index((nx, t * 2 - 1), 'rRRq')]
    g.layer(cells)
    for (x, y) in ((6, 7), (9, 7), (7, 9), (10, 9), (8, 11), (6, 10), (9, 12)):
        if g.get(x, y) not in '.A':
            g.set(x, y, 'i')
    g.stamp_ring(['G.d.G', '.GdG.', 'dGGGd'], 6, 2)
    g.stamp(['.N', 'N.'], 8, 0)
    g.set(5, 6, 'w')
    return recolor(icon(g.rows()), tint)


def round_zucchini_icon(ramp, spots):
    g = Grid(16, 16)
    g.ball(8, 9, 6.0, 5.8, ramp, ring='A', light=(-0.5, -0.7, 0.55))
    for (x, y) in ((5, 6), (6, 9), (5, 12), (8, 5), (9, 8), (8, 12), (11, 7), (11, 11), (10, 13)):
        if g.get(x, y) not in '.A':
            g.set(x, y, spots)
    g.stamp(['.dd', 'dd.', 'd..'], 7, 1)
    g.set(6, 6, 'w')
    return icon(g.rows())


def round_zucchini_ripe(base, ramp, spot):
    g = Grid(16, 16)
    g.ball(4.5, 12.0, 3.2, 3.0, ramp, ring='A')
    g.ball(11.5, 12.5, 3.0, 2.8, ramp, ring='A')
    for (x, y) in ((4, 11), (11, 12), (3, 13)):
        g.set(x, y, spot)
    g.set(3, 10, 'w')
    return over(base, art(g.rows(), outline=1, w=16, h=16))


def bumpy_pumpkin_icon(tint):
    """Citrouille galeuse : la citrouille d'Étampes, couverte de petites bosses claires."""
    g = Grid(16, 16)
    lobes = [(3.4, 2.9, -0.3), (12.6, 2.9, -0.25), (5.8, 3.4, -0.1), (10.2, 3.4, -0.05), (8.0, 3.2, 0.1)]
    for i, (cx, rx, bias) in enumerate(lobes):
        g.ball(cx, 9.6, rx, 5.4 - (0.7 if i < 2 else 0), 'iyYo', ring='o' if i else 'A', bias=bias)
    for x in range(6, 11):
        if g.get(x, 4) in 'iyY':
            g.set(x, 4, 'o')
    g.stamp(['.dN', 'dN.', 'N..'], 7, 2)
    for (x, y) in ((3, 9), (5, 11), (7, 8), (9, 10), (11, 12), (12, 9), (6, 13), (10, 7), (4, 12), (8, 12), (13, 11)):
        if g.get(x, y) in 'yY':
            g.set(x, y, 'i')
    im = icon(g.rows())
    return recolor(im, tint)


def bumps_on(im, tint):
    """Bosses sur la citrouille mûre (parcelle) : un pixel clair sur trois du fruit."""
    return speckle(im, {tint[Y_]: tint[i_]}, step=4, phase=1)


def cut_potato_icon(skin, flesh):
    """Pomme de terre coupée : une entière derrière, une moitié tranchée devant montrant la chair bleue."""
    g = Grid(16, 16)
    g.ball(6, 7.5, 4.8, 4.2, skin, ring='A')
    for (x, y) in ((4, 6), (7, 9), (8, 5)):
        if g.get(x, y) not in '.A':
            g.set(x, y, '0')
    g.ball(10, 10.5, 4.6, 4.0, skin, ring='A')
    g.ball(10, 10.3, 3.4, 2.9, flesh, ring=None, light=(-0.3, -0.5, 0.8))
    for (x, y) in ((10, 10), (9, 11), (11, 11)):
        g.set(x, y, '8')
    g.set(3, 5, 'w')
    return icon(g.rows())


def marbled_potato_icon():
    g = Grid(16, 16)
    g.ball(8, 9.5, 6.2, 5.0, '/|5', ring='A')
    for (x, y) in ((5, 8), (6, 9), (9, 7), (10, 8), (11, 11), (7, 12), (8, 11), (4, 11), (12, 9)):
        if g.get(x, y) not in '.A':
            g.set(x, y, '8' if g.get(x, y) == '/' else '9')
    g.set(4, 7, 'w')
    return icon(g.rows())


def sunflower_icon(petals, center):
    g = Grid(16, 16)
    for a in range(0, 360, 30):
        cx = 8 + 4.6 * math.cos(math.radians(a))
        cy = 7.5 + 4.6 * math.sin(math.radians(a))
        g.ball(cx, cy, 1.8, 1.8, petals, ring='A')
    g.ball(8, 7.5, 3.4, 3.4, center, ring='A')
    for (x, y) in ((7, 6), (9, 8), (8, 9), (6, 8)):
        g.set(x, y, center[-1])
    g.rect(8, 12, 8, 15, 'd')
    g.stamp(['GG.', '.Gd'], 9, 13)
    return icon(g.rows())


def star_apple_icon():
    """Petite pomme Api étoilé : rouge, joue jaune, cinq côtes en étoile autour de l'œil (vue un peu de dessus)."""
    g = Grid(16, 16)
    g.ball(8, 9.5, 5.6, 5.0, 'iyER', ring='A', cuts=[0.92, 0.7, 0.05])
    for k in range(5):
        a = math.radians(-90 + k * 72)
        for r in (1.6, 2.6):
            x, y = math.floor(8 + r * math.cos(a)), math.floor(9.5 + r * math.sin(a) * 0.85)
            g.set(x, y, 'q')
    g.set(7, 9, 'N')
    g.set(8, 9, 'N')
    g.stamp(['..N', '.N.', 'N..'], 7, 2)
    g.stamp(['GG.', 'Gdd'], 9, 2)
    g.set(5, 7, 'w')
    return icon(g.rows())


def star_apple_fruit():
    """Pommes Api étoilé posées sur le pommier : les pommes de tree.apple.summer.ripe, rouge et jaune."""
    ripe, plain = V3S['tree.apple.summer.ripe'], V3S['tree.apple.summer']
    out = img(16, 16)
    a, b, o = ripe.load(), plain.load(), out.load()
    cmap = {K['R']: K['y'], K['r']: K['i'], K['q']: K['E']}
    for y in range(16):
        for x in range(16):
            if a[x, y] != b[x, y] and a[x, y][3]:
                c = a[x, y][:3]
                o[x, y] = cmap.get(c, K['E'] if c != OUT else OUT) + (255,)
    return out


def wheat_sheaf_icon(ramp, beard_c, tie='N'):
    """Gerbe : trois épis évasés aux longues barbes, liés au milieu."""
    g = Grid(16, 16)
    stem = 'd' if ramp[0] in 'yi' else ramp[2]
    for (x0, x1) in ((7, 4), (8, 8), (9, 12)):
        g.line(x0, 15, x1, 10, stem)
    ears = [(3, 5), (7, 3), (11, 5)]
    cells = {}
    for (ex, ey) in ears:
        for k in range(6):
            cells[(ex, ey + k)] = ramp[0] if k % 2 == 0 else ramp[1]
            cells[(ex + 1, ey + k)] = ramp[1] if k % 2 == 0 else ramp[2]
    g.layer(cells)
    g.rect(6, 12, 9, 12, tie)
    im = icon(g.rows())
    # barbes : deux soies fines en V au sommet de chaque épi, sans contour
    bc = PAL[beard_c] + (255,)
    px = im.load()
    for (ex, ey) in ears:
        for k in range(1, 4):
            for (x, y) in ((ex - k + 1, ey - 1 - k), (ex + k, ey - 1 - k)):
                if 0 <= x < 16 and 0 <= y < 16 and px[x, y][:3] != OUT:
                    px[x, y] = bc
    return im


def carrot_heart_icon(body, heart):
    """Carotte coupée en biais : corps d'une couleur, cœur d'une autre (rondelle visible en haut)."""
    base = BASE['carrot'][2]
    im = recolor(base, body)
    px = im.load()
    # le reflet (y) devient le cœur ; on l'épaissit d'un pixel à droite
    hc = PAL[heart] if isinstance(heart, str) else heart
    pts = [(x, y) for y in range(16) for x in range(16) if base.getpixel((x, y))[:3] == y_ and base.getpixel((x, y))[3]]
    for (x, y) in pts:
        px[x, y] = hc + (255,)
        if px[x + 1, y][3] and px[x + 1, y][:3] != OUT:
            px[x + 1, y] = hc + (255,)
    return im


def village_icon(vid, cid):
    if vid == 'apiEtoile':
        return star_apple_icon()
    plant, ripe, ico = BASE[cid]
    tint = TINTS[vid]
    if vid == 'carotteViolette':
        return carrot_heart_icon({Y_: K['|'], o_: K['5'], y_: K['/']}, 'Y')
    if vid == 'marteauDesVertus':
        return long_turnip_icon('|', '/', 'w', 'W')
    if vid == 'barbuDuRoussillon':
        return wheat_sheaf_icon('yYo', 'Y')
    if vid == 'coeurDeBoeufDesVertus':
        return pointed_cabbage_icon('jgGd')
    if vid == 'noireDeCrimee':
        return black_tomato_icon(ico, tint)
    if vid == 'blancDesLandes':
        return corn_icon(ico, (252, 246, 218), (222, 208, 160))
    if vid == 'veloursRouge':
        return sunflower_icon('ER`', 'nNH')
    if vid == 'bleueDArtois':
        return cut_potato_icon('890', '£8')
    if vid == 'madameMoutot':
        return round_strawberry_icon(tint)
    if vid == 'blancheDeVirginie':
        return round_zucchini_icon('W1sS', '1')
    if vid == 'galeuseDEysines':
        return bumpy_pumpkin_icon(tint)
    if vid == 'apiEtoile':
        return star_apple_icon()
    return recolor(ico, tint)


def cross_icon(xid, cid):
    plant, ripe, ico = BASE[cid]
    tint = TINTS[xid]
    if xid == 'crossCarrot':
        im = carrot_heart_icon({}, '|')
    elif xid == 'crossTurnip':
        im = long_turnip_icon('Y', 'y', 'i', 'y')
    elif xid == 'crossWheat':
        im = wheat_sheaf_icon('$%N', '%')
    elif xid == 'crossCabbage':
        im = pointed_cabbage_icon('gGd7', blisters=True)
    elif xid == 'crossTomato':
        im = black_tomato_icon(ico, tint)
        im = recolor(im, {(110, 122, 62): (80, 96, 54)})
    elif xid == 'crossCorn':
        im = corn_icon(ico, (250, 240, 210), K['$'], mixed=True)
    elif xid == 'crossSunflower':
        im = sunflower_icon('iyY', '`6N')
    elif xid == 'crossPotato':
        im = marbled_potato_icon()
    elif xid == 'crossStrawberry':
        im = cone_strawberry_icon(tint)
    elif xid == 'crossZucchini':
        im = round_zucchini_icon('12sG', 'W')
    elif xid == 'crossPumpkin':
        im = bumpy_pumpkin_icon(REDVIF)
    else:
        im = recolor(ico, tint)
    return seal(im)


def variety_tiles(vid, cid):
    """Plant (étape 3) et stade mûr (4) d'une variété : recolorés, avec les retouches de forme."""
    plant, ripe, _ = BASE[cid]
    tint = TINTS[vid]
    r3, r4 = recolor(plant, tint), recolor(ripe, tint)
    if vid in ('blancheDeVirginie', 'crossZucchini'):
        r3 = plant.copy()
        ramp, spot = ('W1s', '1') if vid == 'blancheDeVirginie' else ('12G', 'W')
        r4 = round_zucchini_ripe(plant, ramp, spot)
    elif vid in ('galeuseDEysines', 'crossPumpkin'):
        r4 = bumps_on(r4, tint)
    elif vid in ('noireDeCrimee', 'crossTomato'):
        r4 = shoulders(r4, (110, 122, 62), depth=1, colors={tint[R_], tint[r_], tint[q_]})
    elif vid in ('barbuDuRoussillon', 'crossWheat'):
        r4 = beards(r4, {tint[y_], tint[Y_]}, tint[Y_], length=2)
    elif vid == 'crossCorn':
        r4 = speckle(r4, {tint[y_]: K['$'], tint[Y_]: (250, 240, 210)}, step=3)
    elif vid == 'crossPotato':
        r4 = speckle(r4, {K['/']: K['8']}, step=3)
    elif vid == 'crossCabbage':
        px = r4.load()
        sp = ripe.load()
        for y in range(16):
            for x in range(16):
                if sp[x, y][:3] == g_ and sp[x, y][3] and (x + 2 * y) % 4 == 1:
                    px[x, y] = (150, 200, 110, 255)
    return r3, r4


def heirloom_section():
    for vid, cid in list(VILLAGE.items()) + list(CROSSES.items()):
        is_cross = vid in CROSSES
        add(f'heirloom.{vid}.icon', cross_icon(vid, cid) if is_cross else village_icon(vid, cid))
        if cid == 'apple':
            add('heirloom.apiEtoile.fruit', star_apple_fruit())
            continue
        r3, r4 = variety_tiles(vid, cid)
        if r3.tobytes() != BASE[cid][0].tobytes():
            add(f'heirloom.{vid}.3', r3)
        add(f'heirloom.{vid}.4', r4)


# --- géants (32 × 32) -----------------------------------------------------

def giant_pointed_cabbage(ramp, blisters=False):
    g = Grid(32, 32)
    # feuilles extérieures
    for (cx, cy, rx, ry) in ((7.5, 23, 6.5, 6), (24.5, 23, 6.5, 6), (16, 27, 11, 4)):
        g.ball(cx, cy, rx, ry, ramp[1:], light=(-0.5, -0.6, 0.6))
    for (x0, y0, x1, y1) in ((7, 27, 4, 19), (24, 27, 28, 19)):
        g.line(x0, y0, x1, y1, ramp[0])
    # pomme en goutte, pointe en haut
    cells = {}
    for y in range(2, 28):
        t = (y - 2) / 25
        half = 10.0 * math.sin(math.pi * min(1.0, t * 0.82 + 0.1)) ** 0.85
        for x in range(32):
            nx = (x + 0.5 - 16) / max(half, 0.1)
            if abs(nx) <= 1:
                cells[(x, y)] = ramp[g2.shade_index((nx, (t - 0.55) * 2), ramp, cuts=[0.85, 0.42, -0.25])]
    g.layer(cells)
    # feuilles enroulées : arcs qui montent vers la pointe
    for (x0, y0, x1, y1, ch) in ((16, 26, 16, 5, ramp[0]), (16, 20, 10, 9, ramp[1]), (16, 20, 22, 9, ramp[2]),
                                 (16, 25, 8, 14, ramp[2]), (16, 25, 24, 14, ramp[3])):
        n = max(abs(x1 - x0), abs(y1 - y0))
        for i in range(n + 1):
            x = round(x0 + (x1 - x0) * i / n)
            y = round(y0 + (y1 - y0) * i / n)
            if g.get(x, y) not in '.A':
                g.set(x, y, ch)
    if blisters:
        for y in range(4, 27):
            for x in range(6, 27):
                if g.get(x, y) == ramp[1] and (x + 2 * y) % 5 == 0:
                    g.set(x, y, ramp[0])
                elif g.get(x, y) == ramp[2] and (x + 2 * y) % 5 == 2:
                    g.set(x, y, ramp[3])
    g.stamp(['.ww', 'ww.'], 11, 8)
    return art(g.rows(), w=32, h=32)


def giants_section():
    pal_light = dict(PAL)
    add('heirloom.coeurDeBoeufDesVertus.giant', giant_pointed_cabbage('jgGd'))
    add('heirloom.crossCabbage.giant', giant_pointed_cabbage('gGd7', blisters=True))
    pumpkin = recolor(g2.giant_pumpkin(), REDVIF)
    pumpkin = speckle(pumpkin, {REDVIF[Y_]: REDVIF[i_], REDVIF[y_]: (255, 196, 160)}, step=5, phase=2,
                      test=lambda x, y: y >= 14)
    add('heirloom.crossPumpkin.giant', pumpkin)


# ===========================================================================
# 2. La Grainothèque (32 × 32, lisible à 2 × 2 tuiles)

def stone_wall(g, x0, y0, x1, y1, seed=3):
    """Mur de pierre sèche : pierres claires et moyennes, joints sombres en quinconce."""
    rnd = random.Random(seed)
    g.rect(x0, y0, x1, y1, ']')
    y = y0
    row = 0
    while y <= y1:
        hgt = 2 if (row % 2) else 3
        x = x0 + (row % 2) * 2
        while x <= x1:
            w = rnd.choice((3, 4, 4, 5))
            c = rnd.choice(('[', '[', ']', 'V'))
            g.rect(x, y, min(x + w - 2, x1), min(y + hgt - 2, y1), c)
            if c == '[':
                g.set(x, y, 'W')
            x += w
        y += hgt
        row += 1


def roof(g, x0, x1, y0, y1, ramp='RRq', ridge='N'):
    """Toit de tuiles vu de face (pan incliné vers nous) : rangs de tuiles décalés."""
    for y in range(y0, y1 + 1):
        inset = max(0, (y0 + 2) - y)
        for x in range(x0 + inset, x1 - inset + 1):
            ch = ramp[0] if (y - y0) % 3 == 0 else ramp[1]
            if (x + (y // 3) * 2) % 4 == 0 and (y - y0) % 3 != 0:
                ch = ramp[2]
            g.set(x, y, ch)
    g.rect(x0 + 2, y0, x1 - 2, y0, ridge)


def door(g, x, y, h=7, color=':', dark=',', opened=False):
    g.rect(x, y, x + 3, y + h - 1, 'N')
    if opened:
        g.rect(x + 1, y + 1, x + 3, y + h - 1, 'H')
        g.rect(x + 1, y + 1, x + 2, y + 2, 'y')
        g.set(x + 2, y + 3, 'Y')
        g.rect(x - 1, y + 1, x - 1, y + h - 1, color)
    else:
        g.rect(x + 1, y + 1, x + 2, y + h - 1, color)
        g.rect(x + 2, y + 1, x + 2, y + h - 1, dark)
        g.set(x + 1, y + h // 2, 'y')


def window(g, x, y, lit=False):
    g.rect(x, y, x + 4, y + 3, 'N')
    g.rect(x + 1, y + 1, x + 3, y + 2, 'y' if lit else 'c')
    if not lit:
        g.set(x + 1, y + 1, 'w')
    g.set(x + 2, y + 1, 'N')
    g.set(x + 2, y + 2, 'N')
    # bocaux sur l'appui
    g.set(x + 1, y + 2, 'E')
    g.set(x + 3, y + 2, 'G' if not lit else 'i')
    g.rect(x, y + 4, x + 4, y + 4, 'b')


def corn_braid(g, x, y):
    g.set(x, y, 'n')
    for k in range(1, 5):
        g.set(x, y + k, 'y' if k % 2 else 'Y')
    g.set(x - 1, y + 2, '$')
    g.set(x + 1, y + 3, '$')


def bench(g, x, y, w=6):
    g.rect(x, y, x + w - 1, y, 'b')
    g.rect(x, y + 1, x + w - 1, y + 1, 'B')
    g.set(x, y + 2, 'N')
    g.set(x + w - 1, y + 2, 'N')


def grass_tufts(g, y, x0=1, x1=30):
    for x in range(x0, x1 + 1):
        if g.get(x, y) == '.' and x % 3 != 1:
            g.set(x, y, 'd' if x % 2 else 'G')


def wattle_fence(g, x0, x1, y):
    """Petite clôture de piquets et de branches tressées (jardin d'essai)."""
    for x in range(x0, x1 + 1):
        g.set(x, y, 'B' if x % 2 else 'b')
        g.set(x, y + 1, 'n')
    for x in range(x0, x1 + 1, 3):
        g.rect(x, y - 1, x, y + 2, 'N')


def skep(g, cx, y):
    """Ruche en paille sur un petit tabouret."""
    g.ball(cx, y, 3.0, 3.2, 'iyY', ring='A')
    for yy in (y - 1, y + 1):
        for x in range(int(cx) - 3, int(cx) + 4):
            if g.get(x, yy) in 'iyY':
                g.set(x, yy, 'o')
    g.set(int(cx), y + 2, 'N')
    g.rect(int(cx) - 2, y + 4, int(cx) + 2, y + 4, 'B')
    g.set(int(cx) - 2, y + 5, 'N')
    g.set(int(cx) + 2, y + 5, 'N')


def library_building(n):
    g = Grid(32, 32)
    if n <= 2:
        # remise de pierre sèche : 18 px de large, toit de tuiles ; au niveau 2, un auvent à droite
        wx0, wx1 = (7, 24) if n == 1 else (3, 20)
        roof(g, wx0 - 2, wx1 + 2, 7, 14, ramp='RRq')
        stone_wall(g, wx0, 15, wx1, 28, seed=5)
        g.rect(wx0, 15, wx1, 15, 'U')   # ombre de l'avant-toit
        dx = (wx0 + wx1) // 2 - 1
        door(g, dx, 21, h=8)
        if n == 1:
            g.stamp(['.d.', 'dGd', 'BnB', '.n.'], wx1 + 2, 25)
            window(g, wx1 - 6, 18)
        else:
            # auvent de toile rayée sur deux poteaux, tresses de maïs, banc, pots de fleurs
            for x in range(wx1 + 1, 31):
                g.set(x, 15, 'w' if x % 2 else 'E')
                g.set(x, 16, 'W' if x % 2 else 'R')
                g.set(x, 17, 'w' if x % 2 else '.')
            g.rect(30, 17, 30, 28, 'N')
            corn_braid(g, 23, 17)
            corn_braid(g, 27, 17)
            bench(g, 22, 25, w=7)
            g.stamp(['.E.', 'EyE', 'BnB', '.n.'], wx0 - 1, 25)
            window(g, wx0 + 2, 18)
    else:
        # maison de pierre : 22 px, toit plus haut, cheminée, enseigne ; à droite, ce qui s'ajoute
        wx0, wx1 = 2, 21
        roof(g, wx0 - 2, wx1 + 2, 3, 12, ramp='RRq')
        g.rect(18, 0, 20, 4, ']')
        g.rect(18, 0, 20, 0, 'N')
        stone_wall(g, wx0, 13, wx1, 28, seed=9)
        g.rect(wx0, 13, wx1, 13, 'U')
        door(g, 10, 21, h=8, opened=(n == 5))
        window(g, 3, 19, lit=(n == 5))
        window(g, 16, 19, lit=(n == 5))
        # enseigne « Grainothèque » : planche de bois au-dessus de la porte, bocal et sachet peints
        g.rect(5, 15, 18, 18, 'N')
        g.rect(6, 16, 17, 17, 'k')
        g.stamp(['ss', 'Es'], 7, 16)
        g.stamp(['(E', '(('], 15, 16)
        for x in (10, 11, 13):
            g.set(x, 16, 'N')
        for x in (10, 12, 13):
            g.set(x, 17, 'N')
        if n == 3:
            # tresses de maïs au mur et banc à droite
            corn_braid(g, 24, 15)
            corn_braid(g, 27, 15)
            bench(g, 23, 25, w=7)
        else:
            # jardin d'essai clos à droite : rangs de semis, ruche en paille
            g.rect(23, 23, 31, 27, 'n')
            for y in (24, 26):
                g.rect(23, y, 31, y, 'N')
            for (x, y, c) in ((24, 22, 'E'), (27, 22, 'y'), (30, 22, ':'), (25, 24, 'G'), (29, 24, 'E')):
                g.stamp([f'.{c}.', 'dGd'], x - 1, y)
            skep(g, 27, 16)
            wattle_fence(g, 23, 31, 28)
        if n == 5:
            # rosier grimpant sur la façade et au-dessus de la porte, pots fleuris
            vine = [(2, 27), (2, 25), (3, 23), (2, 21), (3, 18), (4, 16), (5, 14), (7, 13), (9, 13), (15, 13),
                    (17, 13), (19, 14), (20, 16), (21, 18), (20, 21)]
            for (x, y) in vine:
                g.set(x, y, 'd')
                g.set(x + 1, y, 'G')
            for (x, y) in ((3, 26), (2, 22), (4, 17), (6, 13), (10, 12), (16, 12), (20, 15), (21, 20), (3, 19)):
                g.set(x, y, 'p')
                g.set(x, y - 1, 'L')
            g.stamp(['.p.', 'pLp', 'BnB'], 7, 27)
            g.stamp(['.y.', 'yiy', 'BnB'], 14, 27)
    return art(g.rows(), outline=2, w=32, h=32)


def library_site():
    """Coin d'herbe tondue, piquets et ficelle, panneau de bois « ? »."""
    g = Grid(32, 32)
    for (x, y) in ellipse(16, 19, 14.5, 9.5):
        g.set(x, y, 'j' if (x + y) % 5 else 'g')
    for (x, y) in ellipse(16, 19, 14.5, 9.5):
        if y >= 25 or x >= 27:
            g.set(x, y, 'G' if g.get(x, y) == 'j' else g.get(x, y))
    # ficelle entre quatre piquets
    posts = [(5, 13), (27, 13), (27, 25), (5, 25)]
    for i in range(4):
        (x0, y0), (x1, y1) = posts[i], posts[(i + 1) % 4]
        g.line(x0, y0, x1, y1, 'w')
    for (x, y) in posts:
        g.rect(x, y - 3, x, y + 1, 'N')
        g.set(x, y - 3, 'B')
    # panneau « ? »
    g.rect(15, 15, 15, 23, 'N')
    g.rect(10, 7, 21, 14, 'N')
    g.rect(11, 8, 20, 13, 'b')
    g.rect(11, 8, 20, 8, 'k')
    g.stamp(['.NNN.', 'N...N', '...N.', '..N..', '.....', '..N..'], 13, 8)
    # quelques fleurs dans l'herbe
    for (x, y, c) in ((8, 20, 'w'), (23, 21, 'y'), (12, 26, 'w'), (20, 17, 'E')):
        g.set(x, y, c)
    return art(g.rows(), outline=1, w=32, h=32)


def library_window():
    """Fenêtre aux bocaux qui brillent (superposée le soir)."""
    g = Grid(16, 16)
    g.rect(3, 3, 12, 12, 'N')
    g.rect(4, 4, 11, 11, 'i')
    g.rect(4, 4, 11, 5, 'T')
    g.rect(7, 4, 8, 11, 'N')
    g.rect(4, 8, 11, 8, 'N')
    for (x, c) in ((5, 'E'), (10, 'G'), (5, '$'), (10, 'y')):
        pass
    g.stamp(['s', 'E'], 5, 6)
    g.stamp(['s', 'G'], 10, 6)
    g.stamp(['s', 'y'], 5, 10)
    g.stamp(['s', '|'], 10, 10)
    g.rect(2, 13, 13, 13, 'b')
    im = icon(g.rows())
    return glow(im, 8, 8, 7, color=(255, 220, 130), alpha=70)


def library_section():
    add('library.site', library_site())
    for n in range(1, 6):
        add(f'library.{n}', library_building(n))
    add('library.window', library_window())


# ===========================================================================
# 3. Petits objets : sachets, bocaux, étagère, punaise

def troc_pin():
    return icon("""
................
.......AA.......
......AEEA......
......AqEA......
.......AA.......
....((((A(((....
....(((wA(((....
....((((((((....
....)(((((((....
....)((N((((....
....)(NyN(((....
....)((N(d((....
....)((((d((....
....))))))))....
................
................
""")


def seedpack_village():
    return icon("""
................
................
....((((((((....
....(LwLwLwL....
....::::::::....
....((((((((....
....)(E(((y(....
....)EyE(yGy....
....)(E(((y(....
....)((d((d(....
....)((d((d(....
....)(((((((....
....))))))))....
................
................
................
""")


def seedpack_cross():
    im = icon("""
................
.....YY....YY...
......Y....Y....
....yyyYYYYyy...
....iyyyyyyyy...
....iyyyiyyyy...
....iyyiiiyyy...
....iyiiiiiyy...
....iyyiiiyyy...
....iyyiyiyyy...
....iyyyyyyyy...
....iyyyyyyyY...
....YYYYYYYYY...
................
................
................
""")
    im = recolor(im, {})
    sparkle(im, 13, 3)
    return im


def jar(empty):
    rows = """
................
.....NNNNNN.....
.....NbbbbN.....
....AssssssA....
....swwccccs....
....swccccCs....
....swcccccs....
....scccccCs....
....scccccCs....
....scccccCs....
....sccccCCs....
....ssssssss....
................
................
................
................
"""
    im = icon(rows)
    if empty:
        return im
    return im


def jar_empty():
    """Bocal vide : verre pâle, couvercle de bois, petite silhouette de graine au fond (variété à trouver)."""
    g = Grid(16, 16)
    g.rect(5, 1, 10, 2, 'N')
    g.rect(6, 1, 9, 1, 'b')
    for y in range(3, 15):
        for x in range(3, 13):
            if (y in (3, 14) and x in (3, 12)):
                continue
            g.set(x, y, 's')
    for y in range(4, 14):
        for x in range(4, 12):
            g.set(x, y, 'W')
    g.rect(5, 5, 5, 11, 'w')
    g.stamp(['.SS.', 'SSSS', '.SS.'], 7, 10)
    return icon(g.rows())


def jar_glass():
    """Reflet de verre à poser sur une icône : bords bleutés translucides, reflet blanc à gauche."""
    im = img(16, 16)
    px = im.load()
    for y in range(1, 16):
        for x in range(1, 15):
            edge = x in (1, 14) or y in (1, 15)
            if (x, y) in ((1, 1), (14, 1), (1, 15), (14, 15)):
                continue
            if edge:
                px[x, y] = OUT + (255,) if y == 15 or x in (1, 14) else (192, 203, 220, 255)
    for x in range(4, 12):
        px[x, 0] = PAL['N'] + (255,)
        px[x, 1] = PAL['b'] + (255,)
    for y in range(3, 12):
        px[3, y] = (255, 255, 255, 170)
    for y in range(3, 6):
        px[4, y] = (255, 255, 255, 110)
    for y in range(2, 15):
        px[2, y] = (220, 236, 248, 90)
        px[13, y] = (150, 180, 220, 110)
    px[12, 3] = (255, 255, 255, 140)
    return im


def shelf_wood():
    """Planche d'étagère (autotuile horizontale) : fond de bois sombre et planche claire en bas."""
    im = img(16, 16)
    px = im.load()
    for y in range(16):
        for x in range(16):
            if y < 11:
                c = PAL['N'] if (x % 8 == 7) else (PAL['H'] if y % 5 == 0 else (140, 74, 62))
            elif y == 11:
                c = PAL['k']
            elif y < 14:
                c = PAL['b']
            elif y == 14:
                c = PAL['B']
            else:
                c = OUT
            px[x, y] = c + (255,)
    for x in (3, 12):   # équerres
        px[x, 15] = PAL['n'] + (255,)
    return im


def small_items_section():
    add('troc.pin', troc_pin())
    add('seedpack.village', seedpack_village())
    add('seedpack.cross', seedpack_cross())
    add('jar.empty', jar_empty())
    add('jar.glass', jar_glass())
    add('shelf.wood', shelf_wood())


# ===========================================================================
# 4. Les habitants (regard vers la GAUCHE ; deux images) et leurs indices

def wild_bee(frame):
    """Osmie rousse et noire : tête et thorax noirs, abdomen roux velu ; posée sur une fleur / en vol."""
    g = Grid(16, 16)
    oy = 0 if frame else 1
    if frame == 0:   # la fleur sous elle
        g.rect(8, 13, 8, 15, 'd')
        g.stamp(['.ww.ww.', 'wwwyyww', '.wwwww.'], 5, 11)
    g.ball(10.0, 6.5 + oy, 3.4, 2.6, '$$%', ring='A')       # abdomen roux
    for x in (9, 11):
        for y in range(4 + oy, 10 + oy):
            if g.get(x, y) == '$':
                g.set(x, y, '%')
    g.ball(5.8, 6.5 + oy, 2.0, 2.0, '+&', ring='A')          # thorax
    g.ball(3.0, 7.0 + oy, 1.8, 1.8, '+&', ring='A')          # tête
    g.set(2, 6 + oy, 'w')
    g.set(1, 5 + oy, 'A'); g.set(0, 4 + oy, 'A')             # antenne
    if frame == 0:
        g.stamp(['.A.A', 'A.A.'], 4, 9 + oy) if False else None
        g.stamp(['WW..', 'WccW', '.WWW'], 5, 2 + oy)          # ailes repliées sur le dos
    else:
        g.stamp(['.WW..WW', 'WccWWccW', '.WWW.WW'], 4, 0)     # ailes levées
        g.stamp(['A.A.A'], 4, 10)                             # pattes pendantes
    return art(g.rows(), outline=1, w=16, h=16)


def blackbird(frame):
    """Merle noir au bec jaune : le rouge-gorge du lot 4 repeint en noir, bec et cercle de l'œil jaunes."""
    src = L4S['bird.robin.1' if frame else 'bird.robin']
    im = src.copy()
    px = im.load()
    cmap = {K['B']: (58, 54, 66), K['n']: (34, 30, 40), K['Y']: (70, 66, 80), K['W']: (82, 78, 94),
            K['N']: (200, 140, 40)}
    eye = None
    for y in range(16):
        for x in range(16):
            p = px[x, y]
            if p[3] and p[:3] == K['Z'] and eye is None:
                eye = (x, y)
    for y in range(16):
        for x in range(16):
            p = px[x, y]
            if not p[3]:
                continue
            if p[:3] == K['Z']:
                px[x, y] = K['y'] + (255,)
            elif p[:3] in cmap:
                px[x, y] = cmap[p[:3]] + (255,)
    if eye:
        px[eye] = (20, 18, 24, 255)
    if frame == 0:   # il chante : bec entrouvert, petite note
        bx = max(x for y in range(16) for x in range(16) if px[x, y][3] and px[x, y][:3] == K['y'])
        by = [y for y in range(16) if px[bx, y][3] and px[bx, y][:3] == K['y']][0]
        if by - 1 >= 0:
            px[bx, by - 1] = K['y'] + (255,)
            if bx + 1 < 16:
                px[bx + 1, by - 1] = OUT + (255,)
    return flip(im)


LIZARD = ["""
................
................
................
................
................
................
................
..........}.....
...}.....}......
.{{{}{{}{{}.....
{&{{{{{{{{{}}...
.{}}}}}}}}}}}}..
...}......}...}}
..........}.....
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
..........}.....
...}.....}......
.{{{}{{}{{}.....
{&{{{{{{{{{}}...
.{}}}}}}}}}}}...
...}......}.}...
..........}..}}.
................
................
"""]


def lizard(frame, stone=True):
    """Lézard gris-brun allongé sur une pierre ; à la seconde image, le bout de la queue bouge."""
    g = Grid(16, 16)
    if stone:
        g.ball(8, 14, 7.4, 2.6, '[]V', ring='A')
        for y in range(16):
            for x in range(16):
                if g.get(x, y) == 'A':
                    g.set(x, y, '.')
    st = art(g.rows(), outline=1, w=16, h=16)
    lz = art(rows_of(LIZARD[frame]), outline=1, w=16, h=16)
    st.alpha_composite(lz, (0, 1))
    return st


def bat(frame):
    """Pipistrelle brune : ailes ouvertes (vol) ; repliée, suspendue la tête en bas."""
    if frame == 0:
        rows = """
................
................
................
................
.A.....A.A.....A
.AA....AAA....AA
.A~A..A~~~A..A~A
.A~~A.A&~&A.A~~A
.A~;~AA~~~AA~;~A
.A~;~~~~~~~~~;~A
..A;~~~*~*~~~;A.
..A~;~~~*~~~;~A.
...A~~AA~AA~~A..
....AA..A..AA...
................
................
"""
        return art(rows_of(rows), outline=0, w=16, h=16)
    rows = """
........NNN.....
.........N......
........A.A.....
.......A~~~A....
......A~;~;~A...
......A~;*;~A...
......A~;*;~A...
......A~;*;~A...
......A~;~;~A...
.......A~~~A....
.......A~~~A....
.......A&~&A....
.......AA~AA....
........A.A.....
................
................
"""
    return art(rows_of(rows), outline=0, w=16, h=16)


def wild_section():
    for sid, fn in (('wildBee', wild_bee), ('blackbird', blackbird), ('lizard', lizard), ('bat', bat)):
        add(f'wild.{sid}', fn(0))
        add(f'wild.{sid}.1', fn(1))


def hint_mud():
    """Bouchons de terre au bout de tiges creuses (le nid de l'osmie), vus par le bout."""
    g = Grid(16, 16)
    tubes = [(4.5, 4.5, True), (9.5, 4.0, True), (2.5, 9.0, False), (7.0, 8.5, True), (12.0, 8.5, True),
             (4.5, 13.0, True), (9.5, 12.8, False), (13.5, 13.0, True)]
    for (cx, cy, plug) in tubes:
        g.ball(cx, cy, 2.4, 2.4, 'kb', ring='A')
        g.ball(cx, cy, 1.4, 1.4, 'nN' if plug else 'HH', ring=None, light=(0.5, 0.6, 0.6))
    return icon(g.rows())


def hint_tail():
    """Petite queue qui file entre deux pierres."""
    g = Grid(16, 16)
    g.ball(4.0, 10.5, 3.8, 3.4, '[]V', ring='A')
    g.ball(12.2, 10.0, 3.6, 3.8, '[]V', ring='A')
    for (x, y) in ((7, 11), (8, 11), (8, 12), (9, 12), (10, 13), (11, 13), (12, 14), (13, 14)):
        g.set(x, y, '}')
    g.set(7, 11, '{')
    im = icon(g.rows())
    for (x, y) in ((1, 15), (2, 15), (4, 15), (14, 15)):
        im.putpixel((x, y), PAL['S'] + (255,))
    return im


def hint_moon():
    """Croissant de lune et petite ombre ailée."""
    g = Grid(16, 16)
    g.ball(6, 6, 4.6, 4.6, 'iyY', ring='A')
    for (x, y) in ellipse(8.6, 4.4, 4.0, 4.0):
        g.set(x, y, '.')
    im = icon(g.rows())
    bat_ = ['A.....A', 'AA.A.AA', 'AAAAAAA', '.A.A.A.', '...A...']
    for y, line in enumerate(bat_):
        for x, ch in enumerate(line):
            if ch == 'A':
                im.putpixel((8 + x, 10 + y), PAL['<'] + (255,))
    return im


def hints_section():
    add('wild.hint.mud', hint_mud())
    add('wild.hint.tail', hint_tail())
    add('wild.hint.moon', hint_moon())


# ===========================================================================
# 5. Nichoir à chauves-souris et pictogrammes

BATBOX = """
................
....AAAAAAAA....
...ANNNNNNNNA...
...AnBnBnBnBA...
...AnBnBnBnBA...
...AnBnBnBnBA...
...AnBnBnBnBA...
...AnBnBnBnBA...
...AnBnBnBnBA...
...AnBnBnBnBA...
...AnBnBnBnBA...
...A&&&&&&&&A...
...AAAAAAAAAA...
...ANBnBnBnBA...
...AAAVUAAAAA...
.......VU.......
"""


def batbox():
    """Nichoir à chauves-souris : caisse plate de bois sombre, fente d'entrée en bas, planchette d'envol."""
    rows = rows_of(BATBOX)
    rows = [r.replace('B', 'H').replace('n', 'N') if 2 < i < 11 else r for i, r in enumerate(rows)]
    im = art(rows, outline=1, w=16, h=16)
    px = im.load()
    for y in range(3, 11):   # veinage plus clair une planche sur deux
        for x in (5, 9):
            px[x, y] = PAL['n'] + (255,)
    for x in range(4, 12):
        px[x, 2] = PAL['n'] + (255,)
    for y, line in enumerate(['k.....k', 'kk.k.kk', '.kkkkk.', '..k.k..']):
        for x, ch in enumerate(line):
            if ch == 'k':
                px[4 + x, 5 + y] = PAL['b'] + (255,)
    return im


def batbox_icon():
    """Picto : la caisse plate et une chauve-souris qui en sort."""
    g = Grid(16, 16)
    g.rect(4, 6, 11, 14, 'B')
    for x in (6, 9):
        g.rect(x, 7, x, 12, 'n')
    g.rect(4, 6, 11, 6, 'N')
    g.rect(4, 13, 11, 13, '&')
    g.rect(5, 15, 10, 15, 'n')
    g.stamp(['&.....&', '&&.&.&&', '.&&&&&.', '..&.&..'], 5, 0)
    return icon(g.rows())


TRAIT_SCENTED = """
................
................
...s.....s......
..s.....s.......
...s.....s......
....s.....s.....
...s.....s......
................
.....p.p........
....pLpLp.......
.....pyp........
....pLpLp.......
.....p.p........
.......d..G.....
.......dGG......
.......d........
"""

ICON_LIBRARY = """
................
.......NN.......
.....NNRRNN.....
...NNRRRRRRNN...
..NRRqRRqRRqRN..
..NNNNNNNNNNNN..
...[]W[[]][[]...
...[[[]][[NN]...
...]NNN]W[NsN...
...[NcN[[[NEN...
...[N:N][]NNN...
...]N:N[[[[]]...
...[N,N]][[]]...
...]]]]]]]]]]...
................
................
"""

ICON_SWAP = """
................
....CC..........
...C...((((.....
..C....(wLw.....
..C....)(((.....
.CCC...)(E(.....
..C....)))).....
................
.....(((()...C..
.....(yGy)...C..
.....(((()...C..
.....)((d)..CCC.
.....))))....C..
...........CC...
................
................
"""


def icon_cross():
    """Deux fleurs reliées par une abeille (trajet pointillé)."""
    g = Grid(16, 16)
    for (cx, c) in ((3, 'E'), (12, 'P')):
        g.stamp([f'.{c}.', f'{c}y{c}', f'.{c}.'], cx - 1, 7)
        g.rect(cx, 10, cx, 15, 'd')
        g.set(cx + 1, 12, 'G')
        g.set(cx - 1, 13, 'G')
    im = icon(g.rows())
    # trajet pointillé en arc
    for (x, y) in ((4, 5), (5, 3), (10, 3), (11, 5)):
        im.putpixel((x, y), PAL['N'] + (255,))
    bee = icon(rows_of("""
..ww..
.wccw.
&yy&y&
&yy&yA
.&&&&.
"""), w=16, h=16).crop((0, 0, 8, 7))
    im.alpha_composite(bee, (5, 0))
    return im


POLLEN = ["""
..ww....
.wcw.ww.
..wwcw..
.&y&y&..
&wy&y&A.
.&y&yA..
..AAA...
........
""", """
.....y..
.y......
...i..y.
..y.....
......i.
.i..y...
....i...
.y......
"""]


ALBUM_SWAPS = """
................
................
..((((((........
..(wLwLw........
..((((((........
..)(E((((((((...
..)EyE(LwLwLw...
..)(E(((((((....
..)(d()(y(((....
..)(d()yGy((....
..))))))(y((....
.......)(d((....
.......)((((....
.......)))))....
................
................
"""

ALBUM_CROSSES = """
................
....AA....AA....
....AyA..AyA....
.....AyAAyA.....
....AAAAAAAA....
...AyyiiyyyYA...
..AyiiyyyyyYYA..
..AyiyyNNyyYYA..
..AyyyNyyNyYYA..
..AyyyNyyNyYoA..
..AyyyyNNyYYoA..
...AyyyyyyYoA...
....AYYYYYoA....
.....AAAAAA.....
................
................
"""

ALBUM_WILDLIFE2 = """
................
................
.............AA.
............A&A.
...........A&+A.
..........A&+&A.
.........A&+&A..
........A&+&A...
.......A&+&A....
......A&+&A.....
.....A&+&A......
....A&&+A.......
...A&&+A........
..AyAAA.........
.AyA............
..A.............
"""


def icons_section():
    add('nature.batbox', batbox())
    add('icon.nature.batbox', batbox_icon())
    add('icon.trait.scented', icon(TRAIT_SCENTED))
    add('icon.library', icon(ICON_LIBRARY))
    add('icon.swap', icon(ICON_SWAP))
    add('icon.cross', icon_cross())
    add8('fx.pollen', art(rows_of(POLLEN[0]), outline=0, w=8, h=8))
    add8('fx.pollen.1', art(rows_of(POLLEN[1]), outline=0, w=8, h=8))
    add('album.page.swaps', icon(ALBUM_SWAPS))
    add('album.page.crosses', art(rows_of(ALBUM_CROSSES), outline=0, w=16, h=16))
    add('album.page.wildlife2', art(rows_of(ALBUM_WILDLIFE2), outline=0, w=16, h=16))


# ===========================================================================
# 6. Vignettes (48 × 32)

def joseph(g, x, y, point=True):
    """Joseph de profil (regard à droite) : casquette, barbe blanche, chemise à carreaux, bras tendu."""
    g.stamp(['.JJJJ...', 'JJJJJJd.', '.ffff...', '.fZff...', 'Wfffe...', 'WWWff...', '.WWW....'], x, y)
    for yy in range(y + 7, y + 14):
        for xx in range(x, x + 6):
            g.set(xx, yy, 'q' if (xx % 3 == 0 or yy % 3 == 0) else 'R')
    if point:
        g.rect(x + 6, y + 8, x + 9, y + 8, 'R')
        g.rect(x + 10, y + 8, x + 11, y + 8, 'f')
    g.rect(x + 1, y + 14, x + 4, y + 17, 'x')
    g.rect(x + 1, y + 18, x + 2, y + 18, 'N')
    g.rect(x + 3, y + 18, x + 4, y + 18, 'N')


def sky(g, W, top, bot, y0, y1):
    for y in range(y0, y1 + 1):
        g.rect(0, y, W - 1, y, top if y < (y0 + y1) // 2 else bot)


def story_library():
    """Joseph montre un coin d'herbe derrière la maison."""
    g = Grid(48, 32)
    sky(g, 48, 'c', 'v', 0, 14)
    g.rect(0, 15, 47, 31, 'G')
    for (x, y) in ((5, 18), (20, 25), (33, 19), (42, 27), (12, 29), (28, 30), (38, 22)):
        g.set(x, y, 'd')
    # mur de la maison à gauche (pierre et coin du toit)
    stone_wall(g, 0, 6, 9, 24, seed=2)
    for y in range(0, 7):
        g.rect(0, y, 12 - y, y, 'R' if y % 2 else 'q')
    # coin d'herbe tondue avec piquets
    for (x, y) in ellipse(33, 23, 11, 5):
        g.set(x, y, 'j')
    for (x0, y0, x1, y1) in ((24, 20, 42, 20), (24, 20, 24, 26), (42, 20, 42, 26)):
        g.line(x0, y0, x1, y1, 'w')
    for (x, y) in ((24, 20), (42, 20), (24, 26), (42, 26)):
        g.rect(x, y - 2, x, y + 1, 'N')
    # panneau « ? »
    g.rect(33, 16, 33, 22, 'N')
    g.rect(29, 9, 37, 16, 'N')
    g.rect(30, 10, 36, 15, 'b')
    g.rect(30, 10, 36, 10, 'k')
    g.stamp(['NNN', '..N', '.N.', '...', '.N.'], 32, 10)
    # Joseph
    joseph(g, 12, 10)
    # nuages et soleil
    g.stamp(['.ww.', 'wwww'], 20, 3)
    g.stamp(['.www.', 'wwwww'], 38, 5)
    g.ball(44, 2, 2.6, 2.6, 'iy', ring=None)
    im = art(g.rows(), outline=0, w=48, h=32)
    return frame_border(im)


def story_cross():
    """Deux fleurs côte à côte et une abeille au soleil."""
    g = Grid(48, 32)
    sky(g, 48, 'c', 'v', 0, 20)
    g.ball(40, 6, 5, 5, 'Tiy', ring=None)
    for (x, y) in ellipse(40, 6, 7.5, 7.5):
        if g.get(x, y) in 'cv':
            g.set(x, y, 'T' if (x + y) % 2 else g.get(x, y))
    g.rect(0, 21, 47, 31, 'G')
    for x in range(0, 48, 3):
        g.set(x, 21, 'd')
    # deux grandes fleurs : tomate jaune ? fleurs génériques : rose et jaune
    for (cx, cy, petal, petal2) in ((14, 13, 'E', 'p'), (30, 14, 'P', 'Q')):
        g.rect(cx, cy + 3, cx, 30, 'd')
        g.stamp(['GG.', '.Gd'], cx + 1, cy + 9)
        g.stamp(['.GG', 'dG.'], cx - 3, cy + 12)
        for a in range(0, 360, 60):
            px_ = cx + 3.2 * math.cos(math.radians(a))
            py_ = cy + 3.2 * math.sin(math.radians(a))
            g.ball(px_, py_, 2.0, 2.0, petal + petal2, ring=None)
        g.ball(cx + 0.5, cy + 0.5, 2.0, 2.0, 'yY', ring=None)
    # abeille entre les deux, trajet pointillé
    for (x, y) in ((17, 8), (19, 6), (21, 5), (27, 6), (29, 8)):
        g.set(x, y, 'N')
    g.stamp(['.ww.', 'wccw', 'AyAy', 'yAyA', '.AA.'], 22, 3)
    # pollen doré
    for (x, y) in ((12, 9), (16, 10), (31, 10), (28, 11), (24, 9)):
        g.set(x, y, 'i')
    im = art(g.rows(), outline=0, w=48, h=32)
    return frame_border(im)


def story_library5():
    """La Grainothèque fleurie et des visiteurs."""
    g = Grid(48, 32)
    sky(g, 48, 'c', 'v', 0, 12)
    g.rect(0, 13, 47, 31, 'G')
    g.stamp(['.ww.', 'wwww'], 4, 3)
    g.stamp(['.www.', 'wwwww'], 34, 2)
    im = art(g.rows(), outline=0, w=48, h=32)
    b = library_building(5)
    im.alpha_composite(b, (8, 0))
    # visiteurs : deux silhouettes devant la porte, un enfant
    v = Grid(48, 32)
    for (x, hat, shirt) in ((3, 'n', 'C'), (43, 'Q', 'E'), (39, None, 'y')):
        small = x == 39
        top = 22 if not small else 25
        if hat:
            v.rect(x, top - 1, x + 2, top - 1, hat)
        v.rect(x, top, x + 2, top + 1, 'f')
        v.set(x + (0 if x > 24 else 2), top, 'Z')
        v.rect(x, top + 2, x + 2, top + 5 - (1 if small else 0), shirt)
        v.rect(x, top + 6 - (1 if small else 0), x + 2, top + 7 - (1 if small else 0), 'x')
    vim = art(v.rows(), outline=1, w=48, h=32)
    im.alpha_composite(vim)
    # fleurs au premier plan
    px = im.load()
    for (x, c) in ((2, 'E'), (7, 'y'), (12, 'w'), (31, 'p'), (45, 'y'), (20, 'w')):
        px[x, 30] = PAL[c] + (255,)
        px[x, 29] = PAL['d'] + (255,) if px[x, 29][:3] == PAL['G'] else px[x, 29]
    return frame_border(im)


def vignette_section():
    add('story.library', story_library())
    add('story.cross', story_cross())
    add('story.library5', story_library5())


# ===========================================================================
# 7. Décors de l'album et succès

def swap_basket():
    """Panier d'osier plein de sachets."""
    g = Grid(16, 16)
    # anse
    for (x, y) in ellipse(8, 7, 5.5, 5.5):
        if y <= 7 and ((x + 0.5 - 8) ** 2 + (y + 0.5 - 7) ** 2) >= 4.4 ** 2:
            g.set(x, y, 'B')
    # sachets qui dépassent
    g.stamp(['((E', '(w(', '((('], 4, 5)
    g.stamp(['::', 'LL', '(('], 7, 4)
    g.stamp(['yYy', 'yiy', 'yyy'], 9, 5)
    # panier tressé
    for y in range(8, 15):
        for x in range(2, 14):
            inset = 1 if y == 14 else 0
            if inset <= x - 2 <= 11 - inset * 2 + inset:
                g.set(x, y, 'b' if (x + y) % 2 else 'B')
    g.rect(2, 8, 13, 8, 'n')
    g.rect(3, 14, 12, 14, 'n')
    return icon(g.rows())


def cross_sign():
    """Enseigne de bois « Ferme semencière » : planche sur un poteau, épi et sceau doré peints."""
    g = Grid(16, 16)
    g.rect(7, 9, 8, 15, 'N')
    g.rect(8, 9, 8, 15, 'n')
    g.rect(1, 2, 14, 9, 'N')
    g.rect(2, 3, 13, 8, 'b')
    g.rect(2, 3, 13, 3, 'k')
    for x in range(2, 14):
        g.set(x, 6, 'B' if x % 3 else 'b')
    # épi (gauche) et sceau doré (droite)
    g.stamp(['.y', 'yY', '.y', 'yY', '.d'], 3, 3)
    g.stamp(['.yy.', 'yiYy', 'yYYo', '.oo.'], 9, 4)
    # lettres suggérées
    for x in (6, 7):
        g.set(x, 5, 'N')
    g.set(6, 7, 'N')
    return icon(g.rows())


def lizard_wall():
    """Muret de pierres sèches et son lézard."""
    g = Grid(16, 16)
    stone_wall(g, 0, 8, 15, 15, seed=11)
    im = icon(g.rows())
    im.alpha_composite(lizard(0, stone=False), (0, -4))
    return im


ACH_MOTIF = {
    'firstSwap': ['((((..', '(wLw..', '(E(yyy', '(((yiy', '..yiiy', '..yyyy'],
    'villageSeeds': ['.NNNN.', 'swwccs', 'scEccs', 'sccGcs', 'scyccs', '.ssss.'],
    'firstCross': ['.E...P.', 'EyE.PyP', '.E.y.P.', '.d...d.', '.d...d.', '.d...d.'],
    'farmHeritage': ['.Y..Y.', 'yyyyyy', 'yyiyyy', 'yiiiyy', 'yyiyyy', 'YYYYYY'],
    'livingLibrary': ['..NN..', '.NRRN.', 'NRRRRN', '.[]N].', '.[]:].', '.]]:].'],
    'valleyFriends': ['.yy....', 'y......', 'y.&...&', 'y.&&.&&', '.y&&&&&', '..y&.&.'],
}


def ach_icon(motif):
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


def decor_section():
    add('decor.swap.basket', swap_basket())
    add('decor.cross.sign', cross_sign())
    add('decor.lizard.wall', lizard_wall())


def ach_section():
    for aid, motif in ACH_MOTIF.items():
        im = ach_icon(motif)
        add(f'icon.ach.{aid}', im)
        add(f'icon.ach.{aid}.locked', gc.gray(im))


# ===========================================================================
# Assemblage

SECTIONS = [heirloom_section, giants_section, library_section, small_items_section, wild_section, hints_section,
            icons_section, vignette_section, decor_section, ach_section]


def pack():
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


HEADER = """// Lot V2 de La Vallée vivante (planche « valley2 », assets/sprites/valley2.png) : « Le troc et les croisements »,
// style Kenney. Variétés du village et croisées : heirloom.<id>.icon (12 + 11 ; les croisées portent un petit sceau
// doré en bas à droite), heirloom.<id>.4 (+ .3 quand la variété change le plant ; .0 à .3 et .dead manquants = alias
// de la culture de base, posés ci-dessous), heirloom.apiEtoile.fruit (à poser par-dessus tree.apple.*), géants
// heirloom.coeurDeBoeufDesVertus / crossCabbage / crossPumpkin.giant (32 × 32) ; Grainothèque library.site,
// library.1 … library.5 (32 × 32), library.window ; troc.pin, seedpack.village, seedpack.cross, jar.empty, jar.glass
// (reflet à poser sur une icône), shelf.wood (autotuile horizontale) ; habitants wild.<wildBee|blackbird|lizard|bat>[.1]
// (regard vers la GAUCHE), wild.hint.<mud|tail|moon> ; nature.batbox, icon.nature.batbox, icon.trait.scented,
// icon.library, icon.swap, icon.cross, fx.pollen[.1] (8 × 8 : col/row demi-entiers, w = h = 0.5) ; story.library,
// story.cross, story.library5 (48 × 32) ; album.page.swaps / crosses / wildlife2 ; decor.swap.basket,
// decor.cross.sign, decor.lizard.wall ; icon.ach.<id>[.locked].
// Ajoutés à SPRITES ici même (Object.assign), après sa définition."""

TRAILER = """// Étapes des variétés que la planche ne redessine pas (0 à 2, le plant 3 quand la variété ne le change pas, le fané) :
// celles de la culture de base. Le pommier (apiEtoile) garde tree.apple.* et y pose heirloom.apiEtoile.fruit.
const HEIRLOOM_CROPS_V2 = {
%s
};
for (const [id, cropId] of Object.entries(HEIRLOOM_CROPS_V2)) {
  for (const st of ['0', '1', '2', '3', 'dead']) {
    const name = `heirloom.${id}.${st}`;
    if (!SPRITES[name] && SPRITES[`crop.${cropId}.${st}`]) SPRITES[name] = SPRITES[`crop.${cropId}.${st}`];
  }
}"""


def existing_names(src):
    """Noms de sprites déclarés ailleurs dans atlas.js (hors bloc valley2) : clés littérales et alias écrits en dur."""
    src = re.sub(r'// <valley2:auto>\n.*?// </valley2:auto>', '', src, flags=re.S)
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
    mine = [n for n, _ in ENTRIES + SMALL]
    clash = sorted(set(mine) & existing_names(src))
    if clash:
        raise SystemExit('noms déjà pris dans atlas.js : ' + ', '.join(clash))
    sheet.save(HERE / 'valley2.png', optimize=True)
    allpos = dict(pos)
    allpos.update(small_pos)
    lines = [HEADER, '// Généré par assets/sprites/generate-valley2.py — ne pas modifier à la main.', 'const valley2 = {']
    for name, _ in ENTRIES + SMALL:
        lines.append(f"  '{name}': {js_entry(*allpos[name])},")
    lines.append('};')
    lines.append('Object.assign(SPRITES, valley2);')
    pairs = [f"{vid}: '{cid}'," for vid, cid in list(VILLAGE.items()) + list(CROSSES.items()) if cid != 'apple']
    crops = '\n'.join('  ' + ' '.join(pairs[i:i + 3]) for i in range(0, len(pairs), 3))
    lines.append(TRAILER % crops)
    block = '\n'.join(lines)
    if "  valley2: 'assets/sprites/valley2.png'," not in src:   # planche déclarée dans SHEETS
        if "  valley1: 'assets/sprites/valley1.png',\n" not in src:
            raise SystemExit('planche valley1 absente de SHEETS dans src/render/atlas.js')
        src = src.replace("  valley1: 'assets/sprites/valley1.png',\n",
                          "  valley1: 'assets/sprites/valley1.png',\n  valley2: 'assets/sprites/valley2.png',\n", 1)
    if '// <valley2:auto>' not in src:
        if '// </valley1:auto>\n' not in src:
            raise SystemExit('marqueurs // <valley2:auto> (ou // </valley1:auto>) absents de src/render/atlas.js')
        src = src.replace('// </valley1:auto>\n', '// </valley1:auto>\n\n// <valley2:auto>\n// </valley2:auto>\n', 1)
    new = re.sub(r'(// <valley2:auto>\n).*?(// </valley2:auto>)', lambda m: m.group(1) + block + '\n' + m.group(2),
                 src, flags=re.S)
    atlas.write_text(new)
    n = len(ENTRIES) + len(SMALL)
    print(f'écrit {HERE / "valley2.png"} ({SHEET_COLS} × {rows} tuiles, {n} sprites)')
    if args.contact:
        contact_sheets(Path(args.contact))


def group_of(name):
    if name.startswith('heirloom.'):
        return 'heirlooms'
    if name.startswith('wild.'):
        return 'wildlife'
    if name.startswith(('library.', 'nature.')):
        return 'library'
    if name.startswith('story.'):
        return 'vignettes'
    return 'icons'


def contact_sheets(folder, scale=6):
    """Planches de contrôle : chaque groupe à ×scale, à côté d'originaux (valley1, Kenney)."""
    folder.mkdir(parents=True, exist_ok=True)
    V1 = Image.open(HERE / 'valley1.png').convert('RGBA')
    V1S = g2.atlas_sprites('valley1', V1)
    refs = {
        'heirlooms': [V1S['heirloom.coeurDeBoeuf.icon'], V1S['heirloom.vitelotte.icon'], V1S['heirloom.coeurDeBoeuf.4'],
                      V1S['heirloom.rougeVifDEtampes.giant']],
        'wildlife': [V1S['wild.robin'], V1S['wild.bumblebee'], V1S['wild.frog'], V1S['wild.hint.feather']],
        'library': [V1S['nature.nestbox'], V1S['nature.oak.summer'], V3S['tree.apple.summer']],
        'vignettes': [V1S['story.box']],
        'icons': [V1S['icon.ach.valleyBox'], V1S['icon.ach.valleyBox.locked'], V1S['seedpack.heirloom'],
                  V1S['album.page.heirlooms']],
    }
    groups = {k: [] for k in refs}
    for name, im in ENTRIES:
        groups[group_of(name)].append(im)
    for name, im in SMALL:
        groups['icons'].append(im)
    for key, ims in groups.items():
        for bgname, bg in (('', (132, 198, 105, 255)), ('-parchment', (255, 241, 210, 255)), ('-soil', (189, 108, 74, 255))):
            if bgname == '-parchment' and key not in ('icons', 'heirlooms'):
                continue
            if bgname == '-soil' and key != 'heirlooms':
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
            out.save(folder / f'valley2-art-contact-{key}{bgname}.png')


if __name__ == '__main__':
    main()
