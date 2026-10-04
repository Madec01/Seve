#!/usr/bin/env python3
"""Génère la planche du lot V4 « Les cigognes » de La Vallée vivante (style Kenney, CC0) :

  assets/sprites/valley4.png (planche « valley4 ») : les quatre légendes (icônes, pousses sous leur cloche de verre,
  cloche vide, bocal), les cigognes (debout, en vol, roue, nid sur la roue, clocher), les visiteurs rares (grue et vol
  en V, cerf, loriot, castor et barrage, vers luisants et lueurs) et leurs indices, la forêt de la carte mêlée et
  vieillie, la vignette de l'étape 8, les lumières du village, Joseph et Hélène assis, la boîte en fer au ruban, les
  vignettes des récits et de l'épilogue, les cartes postales des vallées voisines, la couverture du livre et son
  signet, les pictogrammes, onglets, décors et succès.

Contenu : docs/ARCHITECTURE.md, « Vallée vivante — contrats du lot V4 », sous-section « Sprites » ; docs/VALLEE.md § 18.

Même méthode que generate-valley3.py (dont il reprend les outils) : palette Kenney, contour sombre (63, 38, 49),
lumière en haut à gauche, tuiles de 16 px ; 1 px de contour pour les icônes, les bêtes et les objets. Bêtes : regard
vers la GAUCHE (comme wild.<id> du V3 ; le rendu retourne le sprite pour l'autre sens).

Tailles qui ne sont pas des multiples de 16 (8 × 12, 8 × 8, 24 × 12, 24 × 20, 8 × 24, 64 × 80…) : l'image est
rangée dans une case de tuiles entières et son entrée d'atlas porte sa taille exacte (w, h fractionnaires).

Ancrages utiles au rendu :
  - legend.<id>.0 / .1 / .2 et legend.cloche (8 × 12) : la cloche repose sur la terre des 2 dernières lignes ; le
    verre est translucide (on voit le sol au travers) ;
  - stork.wheel (24 × 12) et stork.nest.* (24 × 20) : même pied (bas du poteau au bas de l'image, centré en x = 12) :
    on les pose au même point (le haut de la cheminée) ; la roue du nid est la roue de stork.wheel ;
  - visitor.whiteStork (16 × 24) : pattes au bas de l'image ; stork.steeple (16 × 24) : le bas = la tour coupée.

Le script :
  1. dessine chaque sprite ;
  2. les range dans la planche valley4 (placement automatique, déterministe, 16 tuiles de large) et l'écrit ;
  3. réécrit, dans src/render/atlas.js, le bloc compris entre « // <valley4:auto> » et « // </valley4:auto> »
     (le crée juste après « // </valley3:auto> » s'il n'existe pas encore) et déclare la planche dans SHEETS ;
  4. vérifie qu'aucun nom ne heurte un sprite des autres planches.

Relancer :  python3 assets/sprites/generate-valley4.py   (nécessite Pillow)
Planches de contrôle (×6), forêt de la carte dans ses 4 états, nid sur les 5 maisons, cloches devant les
5 Grainothèques :
            python3 assets/sprites/generate-valley4.py --contact DOSSIER
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


v3m = _load('gen_valley3', HERE / 'generate-valley3.py')
v2 = v3m.v2
v1 = v3m.v1
g2, g3, gc = v1.g2, v1.g3, v1.gc

T = 16
SHEET_COLS = 16
SHEET = 'valley4'
OUT = v1.OUT                 # contour Kenney (63, 38, 49)
img, flip = g3.img, g3.flip
Grid = v1.Grid
ellipse = v1.ellipse
rows_of, frame_border, lerp = v1.rows_of, v1.frame_border, v1.lerp
TOWN = Image.open(HERE / 'tiny-town.png').convert('RGBA')
CAREER = Image.open(HERE / 'career.png').convert('RGBA')
VALLEY1 = Image.open(HERE / 'valley1.png').convert('RGBA')

PAL = dict(v3m.PAL)
PAL.update({
    'ĉ': (164, 184, 140),    # melon gris-vert, clair
    'Ĉ': (124, 146, 108),    # melon gris-vert, ombre
    'ĝ': (230, 200, 92),     # or d'engrain
    'Ĝ': (186, 146, 60),     # engrain, ombre
    'ĥ': (122, 72, 138),     # pourpre de la Merveille
    'Ĥ': (84, 48, 100),      # pourpre, ombre
    'ĵ': (172, 226, 120),    # vert tendre des pois
    'Ĵ': (116, 182, 86),     # pois, ombre
    'ķ': (216, 255, 128),    # lueur vert-jaune
    'Ķ': (150, 214, 80),     # lueur, bord
    'ĺ': (200, 72, 60),      # bec et pattes de cigogne
    'Ļ': (150, 42, 40),      # bec, ombre
    'ŀ': (178, 190, 206),    # gris perle (grue)
    'Ŀ': (128, 140, 160),    # gris perle, ombre
    'ł': (178, 96, 58),      # cerf roux
    'Ł': (132, 66, 44),      # cerf, ombre
    'ń': (40, 92, 70),       # toile verte du livre
    'Ń': (28, 66, 52),       # toile verte, ombre
    'ņ': (66, 128, 94),      # toile verte, clair
})
K = dict(PAL)


def C(c):
    return PAL[c] if isinstance(c, str) else c


def art(rows, outline=2, w=None, h=None, pal=None):
    return g3.art(rows, outline=outline, pal=pal or PAL, w=w, h=h)


def icon(src, pal=None, w=16, h=16):
    rows = rows_of(src) if isinstance(src, str) else src
    assert len(rows) <= h and all(len(r) <= w for r in rows), src
    return art(rows, outline=1, w=w, h=h, pal=pal)


def obj(g, outline=1):
    return g3.art(g.rows(), outline=outline, pal=PAL, w=g.w, h=g.h)


setpx = v3m.setpx
blend_px = v3m.blend_px
recolor = v3m.recolor


def put(im, x, y, c, a=255):
    if 0 <= x < im.width and 0 <= y < im.height:
        im.putpixel((x, y), C(c) + (a,))


def ring_out(im, pts, col=OUT):
    """Contour (4-voisins) autour d'un ensemble de pixels, seulement sur le vide."""
    px = im.load()
    for (x, y) in pts:
        for (dx, dy) in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            q = (x + dx, y + dy)
            if 0 <= q[0] < im.width and 0 <= q[1] < im.height and not px[q][3]:
                px[q] = col + (255,)


# ---------------------------------------------------------------------------
# Registre : nom → image (taille exacte gardée pour l'atlas)

ENTRIES = []
REAL = {}


def add(name, im):
    assert name not in REAL, name
    REAL[name] = im.size
    w = -(-im.width // T) * T
    h = -(-im.height // T) * T
    if (w, h) != im.size:
        pad = img(w, h)
        pad.alpha_composite(im)
        im = pad
    ENTRIES.append((name, im))
    return im


def get(name):
    for n, im in ENTRIES:
        if n == name:
            rw, rh = REAL[n]
            return im.crop((0, 0, rw, rh))
    raise KeyError(name)


# ===========================================================================
# 1. Les légendes : icônes (16 × 16), pousses sous cloche (8 × 12), cloche vide, bocal

def icon_mother_melon():
    g = Grid(16, 16)
    g.ball(8, 9, 5.6, 4.8, 'ĉĉĈ')
    for (x, y) in list(g.cells_ellipse(8, 9, 5.6, 4.8)):    # broderie : un filet blanc en losanges
        if ((x + y) % 5 == 0 or (x - y) % 5 == 0) and g.get(x, y) in 'ĉĈ' and 4 < y < 14:
            g.set(x, y, 'w' if g.get(x, y) == 'ĉ' else 's')
    g.stamp(['.NN', 'N..'], 7, 3)
    g.stamp(['DD.', 'dDD', '.d.'], 9, 1)
    return icon(g.rows())


def icon_mill_einkorn():
    """Trois épis fins d'engrain dorés aux longues barbes (traits fins sans contour), liés en bas."""
    g = Grid(16, 16)
    ears = ((2, 5), (7, 3), (12, 6))                   # (x de l'épi, haut de l'épi)
    for (x0, top) in ears:
        for j in range(5):
            g.set(x0, top + j, 'ĝ' if j % 2 == 0 else 'Ĝ')
            g.set(x0 + 1, top + j, 'Ĝ' if j % 2 == 0 else 'ĝ')
    g.line(3, 10, 7, 13, 'Ĝ'); g.line(7, 8, 7, 13, 'Ĝ'); g.line(12, 11, 8, 13, 'Ĝ')
    g.rect(6, 12, 8, 12, 'N')
    g.set(6, 14, 'Ĝ'); g.set(8, 14, 'Ĝ'); g.set(7, 14, 'Ĝ')
    im = icon(g.rows())
    awn = (214, 172, 70)
    for (x0, top) in ears:                            # longues barbes en V au sommet de chaque épi
        for k in (1, 2, 3):
            put(im, x0 - k + 1, top - k, awn)
            put(im, x0 + k, top - k, awn)
    return im


def icon_farm_marvel():
    g = Grid(16, 16)
    g.ball(8, 9.5, 5.6, 5.0, 'yyY')
    for (x, y) in list(g.cells_ellipse(8, 9.5, 5.6, 5.0)):
        if (x * 2 + y // 3) % 5 in (0, 1) and g.get(x, y) in 'yY':
            g.set(x, y, 'ĥ' if (x < 9 or y < 8) else 'Ĥ')
    g.set(5, 7, 'w'); g.set(6, 6, 'w')
    g.stamp(['.D.D.', 'DDdDD', '..d..'], 6, 3)
    return icon(g.rows())


def icon_stork_pea():
    g = Grid(16, 16)
    # gousse courbe comme une corne
    pts = [(3, 12), (4, 12), (5, 11), (6, 11), (7, 10), (8, 9), (9, 8), (10, 7), (11, 5), (12, 4), (12, 3)]
    for i, (x, y) in enumerate(pts):
        g.set(x, y, 'ĵ'); g.set(x, y + 1, 'Ĵ')
        if 1 < i < len(pts) - 2:
            g.set(x, y - 1, 'ĵ')
    for (x, y) in ((5, 10), (7, 9), (9, 7)):
        g.set(x, y, 'g')
    g.stamp(['.d', 'dd', 'd.'], 1, 12)
    g.set(13, 2, 'd'); g.set(13, 1, 'd')
    return icon(g.rows())


# Pousses sous la cloche : 8 × 12, la plante sur les colonnes 1..6, terre aux lignes 10 et 11
CLOCHE_EDGE = (82, 128, 158)        # bord du verre (lisible sur l'herbe comme sur la neige)
CLOCHE_TINT = (214, 238, 250)


def cloche_mask():
    """Pixels du verre (bord, intérieur) d'une cloche 8 × 12 dont le pied est à la ligne 9."""
    edge, inside = set(), set()
    prof = {0: (2, 5), 1: (1, 6)}
    for y in range(0, 10):
        x0, x1 = prof.get(y, (0, 7))
        for x in range(x0, x1 + 1):
            if x in (x0, x1) or y == 0:
                edge.add((x, y))
            else:
                inside.add((x, y))
    edge |= {(1, 1), (6, 1)}
    inside -= edge
    return edge, inside


def cloche_base():
    im = img(8, 12)
    for x in range(8):
        put(im, x, 10, 'b')
        put(im, x, 11, 'n')
    for x in (1, 4, 6):
        put(im, x, 10, 'B')
    return im


def cloche_glass(im, label=False):
    edge, inside = cloche_mask()
    for (x, y) in inside:
        p = im.getpixel((x, y))
        if p[3]:
            im.putpixel((x, y), lerp(p[:3], CLOCHE_TINT, 0.08) + (255,))
        else:
            im.putpixel((x, y), CLOCHE_TINT + (48,))
    for (x, y) in edge:
        im.putpixel((x, y), CLOCHE_EDGE + (255,))
    # bouton du dessus, reflet blanc en haut à gauche, liseré clair sous le bord haut
    for (x, y) in ((1, 3), (1, 4), (1, 5), (2, 2), (1, 7)):
        im.putpixel((x, y), (255, 255, 255, 255))
    for (x, y) in ((3, 1), (4, 1)):
        im.putpixel((x, y), (190, 226, 244, 255))
    if label:
        for (x, y) in ((5, 8), (6, 8)):
            im.putpixel((x, y), C('b') + (255,))
        im.putpixel((5, 9), C('N') + (255,))
    return im


PLANTS = {
    # (pousse : deux cotylédons) ; (en fleur) ; (mûre) — lettres, origine = colonne 1, posées sur la terre
    'motherMelon': [
        ['GG..GG', '.GddG.', '..dd..'],
        ['..y...', '.yiy..', 'DDyDD.', 'GDdDGD', '..d...'],
        ['DG....', 'GdĉĉĉD', 'ĉwĉwĉĈ', 'ĉĉwĉĈĈ', '.ĈĈĈĈ.'],
    ],
    'millEinkorn': [
        ['d...d.', '.d.d..', '.d.d..', '..d...'],
        ['.D..D.', '.DD.D.', 'D.DDD.', 'D.dD..', '..d...', '..d...'],
        ['ĝ.ĝ..ĝ', '.ĝĜ.ĝ.', '.ĜĝĝĜ.', '..ĜĝĜ.', '..Ĝ.Ĝ.', '...Ĝ..', '...Ĝ..'],
    ],
    'farmMarvel': [
        ['GG..GG', '.GddG.', '..dd..'],
        ['..y...', '.yiy.D', 'DDdDDd', '.dDd..', '..d...'],
        ['..dD..', '.yĥyĥ.', 'ĥyĥyĥY', 'yĥyĥYĤ', '.ĥYĤY.'],
    ],
    'storkPea': [
        ['GG..GG', '.GddG.', '..dd..'],
        ['ww....', 'wwsd..', '.dDDd.', 'd.d.D.', '..d...', '..d...'],
        ['ĵ..d..', 'ĵĵ.dĵ.', '.ĵĵdĵĵ', '.d.ĵĵĴ', '..d.Ĵ.', '..d...'],
    ],
}


def legend_stage(lid, stage):
    im = cloche_base()
    rows = PLANTS[lid][stage]
    y0 = 10 - len(rows)
    for y, line in enumerate(rows):
        for x, ch in enumerate(line):
            if ch != '.':
                put(im, 1 + x, y0 + y, ch)
    return cloche_glass(im)


def legend_cloche_empty():
    im = cloche_base()
    return cloche_glass(im, label=True)


def legend_jar():
    return icon("""
................
.....yyyyyy.....
....yiiiiiiY....
....YYYYYYYY....
.....WqqqqS.....
....WWqEEqSS....
...WwWWWWWWSS...
...WwĉĈWĝWWSS...
...WWĉĉWĝĜWSS...
...WwWWWWWWSS...
...WWĵĴWĥyWSS...
...WwĵWWyĥWSS...
....WWWWWWSS....
.....SSSSSS.....
................
................
""")


def legends_section():
    add('legend.motherMelon.icon', icon_mother_melon())
    add('legend.millEinkorn.icon', icon_mill_einkorn())
    add('legend.farmMarvel.icon', icon_farm_marvel())
    add('legend.storkPea.icon', icon_stork_pea())
    for lid in ('motherMelon', 'millEinkorn', 'farmMarvel', 'storkPea'):
        for st in range(3):
            add(f'legend.{lid}.{st}', legend_stage(lid, st))
    add('legend.cloche', legend_cloche_empty())
    add('legend.jar', legend_jar())


# ===========================================================================
# 2. Les cigognes

STORK_REST = """
................
................
.......ww.......
......wwww......
..ĺĺĺĺwZwww.....
....ĻĻwwww......
.......www......
.......www......
.......wwws.....
......wwwwwws...
.....wwwwwwwZZ..
.....wwwwwZZZZZ.
.....swwZZZZZZZ.
......ssZZZZZZ..
........ss..Z...
........ĺ..ĺ....
........ĺ..ĺ....
........ĺ..ĺ....
........ĺ..ĺ....
........ĺ..ĺ....
........ĺ..ĺ....
........ĺ..ĺ....
.......ĺĺ.ĺĺ....
................
"""

STORK_CLATTER = """
................
.........ĺ......
.........ĺĻ.....
.........ĺĻ.....
.........ĺĻ.....
........wZw.....
........www.....
.......wwws.....
......www.......
......ww........
......wwws......
.....wwwwwws....
.....wwwwwwwZZ..
.....wwwwwZZZZZ.
.....swwZZZZZZZ.
......ssZZZZZZ..
........ĺ..ĺZ...
........ĺ..ĺ....
........ĺ..ĺ....
........ĺ..ĺ....
........ĺ..ĺ....
........ĺ..ĺ....
.......ĺĺ.ĺĺ....
................
"""


def stork_stand(frame):
    return art(rows_of(STORK_CLATTER if frame else STORK_REST), outline=1, w=16, h=24)


STORK_FLY = ["""
................................
................................
.ZZZ.........................ZZZ
..ZZZww....................wwZZZ
...ZZZwww................wwwZZZ.
....ZZZwwww............wwwwZZZ..
.....ZZZwwwww........wwwwwZZZ...
......ZZZwwwwww....wwwwwwZZZ....
.......wZZZwwwwwwwwwwwwwwZZZ.....
ĺĺĺwwwwwwwwwwwwwwwwwwwwwwsĺĺĺĺĺ.
..Ļ.......wwwwwwwwwwwwwss.......
................................
................................
................................
................................
................................
""", """
................................
................................
................................
................................
................................
................................
................................
..........wwwwwwwwwwwww.........
ĺĺĺwwwwwwwwwwwwwwwwwwwwwwsĺĺĺĺĺ.
..Ļ....ZZZwwwwwwwwwwwwwwZZZ.....
......ZZZwwwwww....wwwwwwZZZ....
.....ZZZwwww..........wwwwZZZ...
....ZZZww...............wwwZZZ..
...ZZZ....................ZZZ...
................................
................................
"""]


def stork_fly(frame):
    return art(rows_of(STORK_FLY[frame]), outline=1, w=32, h=16)


def wheel_cells():
    """Roue de charrette à plat (ellipse) : jante, rayons, moyeu (24 × 7, origine (0, 0))."""
    g = Grid(24, 7)
    cx, cy, rx, ry = 11.5, 3.0, 10.5, 3.0
    for (x, y) in g.cells_ellipse(cx, cy, rx, ry):
        g.set(x, y, 'U')
    for (x, y) in g.cells_ellipse(cx, cy, rx - 1.6, ry - 1.0):
        g.set(x, y, '.')
    for k in range(6):
        a = math.radians(k * 30 + 15)
        g.line(round(cx), round(cy), round(cx + (rx - 1) * math.cos(a)), round(cy + (ry - 0.6) * math.sin(a)), 'B')
        g.line(round(cx), round(cy), round(cx - (rx - 1) * math.cos(a)), round(cy - (ry - 0.6) * math.sin(a)), 'B')
    for (x, y) in g.cells_ellipse(cx, cy, rx, ry):
        if y <= 1 and g.get(x, y) == 'U':
            g.set(x, y, 'V')
    g.rect(10, 2, 13, 3, 'N')
    return g


def stork_wheel_grid(H=12):
    g = Grid(24, H)
    w = wheel_cells()
    top = H - 12
    for y in range(7):
        for x in range(24):
            if w.get(x, y) != '.':
                g.set(x, top + 1 + y, w.get(x, y))
    g.rect(11, top + 8, 12, H - 1, 'N')        # poteau court
    g.set(11, top + 8, 'U')
    g.rect(10, H - 1, 13, H - 1, 'U')           # sabot du poteau (sur la cheminée)
    return g


def stork_wheel():
    return obj(stork_wheel_grid(12))


def nest_bowl(g, top):
    """Gros nid de branches sur la roue (lignes top .. top + 6)."""
    rnd = random.Random(8)
    for (x, y) in g.cells_ellipse(11.5, top + 4.0, 11.4, 3.6):
        if y >= top + 1:
            g.set(x, y, rnd.choice('VVU}~'))
    for x in range(1, 23):                          # bord du nid, plus clair
        y = top + 1 + (0 if 4 < x < 19 else 1)
        g.set(x, y, '{' if x % 3 else 'V')
    for (x, y) in ((0, top + 3), (23, top + 4), (2, top + 6), (21, top + 6), (5, top + 7), (18, top + 7)):
        g.set(x, y, '}')                            # brindilles qui dépassent


def nest_base(H=20):
    g = stork_wheel_grid(H)
    nest_bowl(g, H - 12 - 2)
    return g


def mini_stork(g, x0, y0, flip_=False, head_up=False):
    """Cigogne dans le nid (corps seulement, 7 × 9) : tête, cou, dos noir."""
    rows = ['.ĺ.....', '.ĺ.....', '.ww....', '.Zw....', '..w....', '..ww...', '.wwwZ..', '.wwZZZ.', '.wwZZZ.'] if head_up \
        else ['.......', 'ĺĺww...', '..wZ...', '...w...', '...w...', '..www..', '.wwwZZ.', '.wwZZZ.', '.wwZZZ.']
    if flip_:
        rows = [r[::-1] for r in rows]
    g.stamp(rows, x0, y0)


def stork_nest(kind):
    H = 20
    g = Grid(24, H)
    if kind == 'pair':
        mini_stork(g, 3, 0)
        mini_stork(g, 13, 0, flip_=True, head_up=True)
    elif kind == 'chicks':
        mini_stork(g, 1, 0)
        for x0 in (9, 13, 17):
            g.stamp(['.ss.', 'sZss', 'Zss.', '.ss.'], x0, 4)
    base = nest_base(H)
    for y in range(H):
        for x in range(24):
            ch = base.get(x, y)
            if ch != '.' and (g.get(x, y) == '.' or y >= 8):
                g.set(x, y, ch)
    if kind == 'snow':
        for x in range(1, 23):
            y = 7 + (0 if 4 < x < 19 else 1)
            g.set(x, y, 'W')
            g.set(x, y - 1, 'w' if 2 < x < 21 else '.')
        g.set(5, 10, 'W'); g.set(14, 11, 'W'); g.set(9, 13, 'W')
    return obj(g)


STEEPLE = """
....ĺ...........
....ĺ...........
....ww..........
....Zw....ĺĺww..
.....ww.....wZ..
.....ww......w..
....wwwZ....ww..
...wwwZZ...wwwZ.
...wwZZZ..wwwZZ.
..VVUVVUVVUVVUV.
.VUVVUVVUVVUVVUV
..}UVV}VVU}VVU}.
...MMMMMMMMMM...
..MzMMzMMzMMzM..
.MzMzMzMzMzMzMz.
.[[[[[[[[[[]]]].
.[[[[[[[[[[]]]].
.[[[[ZZZZ[[]]]].
.[[[[zZzZ[[]]]].
.[[[[ZZZZ[[]]]].
.[[[[zZzZ[[]]]].
.[[[[ZZZZ[[]]]].
.[]][[[[[[[]]]].
.[[[[[[[[[[]]]].
"""


def stork_steeple():
    """Sommet du clocher du village : ardoises, abat-son, le nid et le couple (l'une claque du bec, tête haute)."""
    return art(rows_of(STEEPLE), outline=1, w=16, h=24)


def storks_section():
    add('visitor.whiteStork', stork_stand(0))
    add('visitor.whiteStork.1', stork_stand(1))
    add('visitor.whiteStork.fly', stork_fly(0))
    add('visitor.whiteStork.fly.1', stork_fly(1))
    add('stork.wheel', stork_wheel())
    add('stork.nest.pair', stork_nest('pair'))
    add('stork.nest.chicks', stork_nest('chicks'))
    add('stork.nest.snow', stork_nest('snow'))
    add('stork.steeple', stork_steeple())


# ===========================================================================
# 3. Les autres visiteurs rares

CRANE = ["""
................
...ZE...........
..ZZZE..........
ŀŀZwZ...........
...Zw...........
...Zw...........
....ŀ...........
....ŀŀ..........
....ŀŀŀŀŀŀŀ.....
....ŀŀŀŀŀŀŀŀZZ..
.....ŀŀŀŀŀŀŀZZZ.
.....ŀŀŀŀŀŀZZZ..
.......ZZ.ZZZ...
........Z.Z.....
........Z.Z.....
.......ZZ.ZZ....
""", """
ŀ...............
.ŀZE............
..ZZE...........
...Zw...........
...Zw...........
....Zw..........
....ŀŀ..........
....ŀŀ..........
....ŀŀŀŀŀŀŀ.....
....ŀŀŀŀŀŀŀŀZZ..
.....ŀŀŀŀŀŀŀZZZ.
.....ŀŀŀŀŀŀZZZ..
.......ZZ.ZZZ...
........Z.Z.....
........Z.Z.....
.......ZZ.ZZ....
"""]


def crane(frame):
    im = art(rows_of(CRANE[frame]), outline=1, w=16, h=16)
    # ombre du gris perle (lumière en haut à gauche)
    px = im.load()
    for y in range(10, 13):
        for x in range(5, 13):
            if px[x, y][:3] == C('ŀ') and (y == 12 or x >= 10):
                px[x, y] = C('Ŀ') + (255,)
    return im


def crane_flock(frame):
    """Vol en V de 7 grues en silhouette (vers la gauche) ; les ailes battent en décalé."""
    im = img(48, 16)
    pos = [(1, 12), (8, 9), (15, 6), (21, 3), (28, 6), (34, 9), (40, 12)]
    for i, (x, y) in enumerate(pos):
        up = (i + frame) % 2 == 0
        pts = [(x + k, y) for k in range(7)] + [(x + 3, y + 1) if False else (x + 4, y)]
        if up:
            pts += [(x + 3, y - 1), (x + 4, y - 1), (x + 4, y - 2), (x + 5, y - 3)]
        else:
            pts += [(x + 3, y + 1), (x + 4, y + 1), (x + 4, y + 2), (x + 5, y + 3)]
        for (px_, py_) in pts:
            put(im, px_, py_, (62, 60, 78))
    return im


DEER = ["""
................................
...V....V.......................
...VV..VV.......................
.V..V..V..V.....................
..V.VVVV.V......................
...VV..VV.......................
.....VV.........................
....łłłł........................
...łłZłłł.......................
..łłłłłłł.......................
.ZZłłłłł........................
..ZZłłłł........................
.....łłł........................
.....łłłł.......................
.....łłłłłłłłłłłłłłłłłł.........
.....łłłłłłłłłłłłłłłłłłł........
......łłłłłłłłłłłłłłłłłłł.......
......łłłłłłłłłłłłłłłłłłłł......
.......łłłłłłłłłłłłłłłłłłw......
.......łłłłłłłłłłłłłłłłłww......
.......ŁłłłŁŁŁŁŁŁŁŁŁŁłłłww......
........ŁŁŁ..........ŁŁŁ.......
........ŁŁ...........ŁŁ........
........ŁŁ...........ŁŁ........
........ŁŁ............ŁŁ.......
........ŁŁ............ŁŁ.......
.......ŁŁ.............ŁŁ.......
.......NN.............NN.......
................................
................................
................................
................................
""", """
................................
................................
.......V....V...................
.......VV..VV...................
.....V..V..V..V.................
......V.VVVV.V..................
.......VV..VV...................
.........VVł....................
........łłłłł...................
...ZZłłłłZłłł...................
..Z.Złłłłłłł....................
..ZZłłłłłłł.....................
.......łłłł.....................
.......łłłłł....................
......łłłłłłłłłłłłłłłłłł........
.....łłłłłłłłłłłłłłłłłłłł.......
......łłłłłłłłłłłłłłłłłłł.......
......łłłłłłłłłłłłłłłłłłłł......
.......łłłłłłłłłłłłłłłłłłw......
.......łłłłłłłłłłłłłłłłłww......
.......ŁłłłŁŁŁŁŁŁŁŁŁŁłłłww......
........ŁŁŁ..........ŁŁŁ.......
........ŁŁ...........ŁŁ........
........ŁŁ...........ŁŁ........
........ŁŁ............ŁŁ.......
........ŁŁ............ŁŁ.......
.......ŁŁ.............ŁŁ.......
.......NN.............NN.......
................................
................................
................................
................................
"""]


def red_deer(frame):
    im = art(rows_of(DEER[frame]), outline=1, w=32, h=32)
    px = im.load()
    # ventre et cou plus sombres, crinière, dos éclairé
    for y in range(14, 21):
        for x in range(5, 27):
            if px[x, y][:3] == C('ł'):
                if y >= 19:
                    px[x, y] = C('Ł') + (255,)
                elif y == 14 and x > 7:
                    px[x, y] = C('n') + (255,)
    for y in range(8, 14):
        for x in range(2, 12):
            if px[x, y][:3] == C('ł') and y >= 11:
                px[x, y] = C('Ł') + (255,)
    if frame:
        # souffle de buée devant le museau
        for (x, y, a) in ((0, 9, 230), (1, 8, 240), (0, 8, 200), (1, 7, 170), (0, 10, 200), (1, 11, 150),
                          (2, 12, 120), (0, 6, 140), (0, 12, 120)):
            if not px[x, y][3]:
                px[x, y] = (246, 250, 255, a)
    return im


ORIOLE = ["""
................
................
................
................
.......yyy......
......yZyyy.....
....OOyyyyy.....
......yyyyZZ....
.....yyyyZZZ....
.....yyyyZZZZ...
......yYYZZZZZ..
.......YY..ZZZ..
.....NNNNNNNNNNN
...NNN....N.....
................
................
""", """
................
................
................
................
.......yyy......
......yZyyy.....
....OO.yyyy.....
.....OOyyyZZ....
.....yyyyZZZ....
.....yyyyZZZZ...
......yYYZZZZZ..
.......YY..ZZZ..
.....NNNNNNNNNNN
...NNN....N.....
................
................
"""]


def oriole(frame):
    im = art(rows_of(ORIOLE[frame]), outline=1, w=16, h=16)
    if frame:
        for (x, y) in ((1, 2), (2, 1), (2, 2), (1, 3)):     # note de musique
            put(im, x, y, OUT)
        put(im, 3, 0, OUT); put(im, 3, 1, OUT)
    return im


BEAVER = ["""
................
................
................
................
................
......~~~.......
.....~;~~~......
....;~~~~~~.....
..ww~~~~~~~~....
.NNw~~~~~~~~~...
.....~~~~~~~;;..
....;~~~~~~;;MM.
....;;~~~~;;MMMM
...;;;.;;;;.MMMM
...........MMM..
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
.....~~~........
....~;~~~~~~~~..
...~~~~~~~~~~~MM
CCcCCCCcCCCCCCCC
CcCCCcCCCCcCCCcC
CCCCCCCCCCCCCCCC
................
................
"""]


def beaver(frame):
    im = art(rows_of(BEAVER[frame]), outline=1, w=16, h=16)
    px = im.load()
    for y in range(16):
        for x in range(16):
            if px[x, y][:3] == C('M') and (x + y) % 2:
                px[x, y] = C('z') + (255,)
    if not frame:
        put(im, 5, 6, 'Z')                                   # œil
        put(im, 3, 9, 'w')                                   # dents
    else:
        put(im, 5, 9, 'Z')
        for (x, y) in ((1, 10), (2, 10), (15, 10)):
            put(im, x, y, 'c')                               # sillage
    return im


def beaver_dam():
    g = Grid(32, 16)
    # ruisseau qui passe de gauche à droite (plus haut en amont)
    g.rect(0, 6, 31, 13, 'C')
    g.rect(0, 6, 13, 7, 'c')
    for x in range(0, 32, 4):
        g.set(x + 1, 9, 'c'); g.set(x + 3, 12, ':')
    # barrage de branches en travers
    rnd = random.Random(3)
    for y in range(4, 15):
        for x in range(14, 19):
            if abs(x - 16 + (y - 9) * 0.25) <= 2:
                g.set(x, y, rnd.choice('VU}~'))
    for (x0, y0, x1, y1) in ((12, 5, 20, 13), (13, 12, 20, 6), (15, 4, 17, 14)):
        g.line(x0, y0, x1, y1, 'U')
    # hutte ronde de branches et de boue, à droite
    for (x, y) in g.cells_ellipse(25.5, 8.5, 5.5, 4.4):
        g.set(x, y, '~' if (x + y) % 3 else '}')
    for (x, y) in g.cells_ellipse(25.5, 8.5, 5.5, 4.4):
        if y <= 6 and g.get(x, y) != '.':
            g.set(x, y, 'V' if x % 2 else '~')
    g.line(21, 5, 30, 11, 'U')
    g.line(22, 11, 29, 5, 'U')
    g.rect(24, 11, 26, 12, 'C')                      # entrée sous l'eau
    return obj(g)


def glowworm_icon():
    g = Grid(16, 16)
    for (x, y) in ((4, 15), (4, 14), (5, 13), (5, 12), (6, 11), (6, 10), (6, 9), (7, 8), (7, 7), (8, 6)):
        g.set(x, y, 'D')
    for (x, y) in ((10, 15), (10, 14), (10, 13), (11, 12), (11, 11)):
        g.set(x, y, 'd')
    g.stamp(['.;;;ķ', ';;;ķķ'], 6, 12)
    im = icon(g.rows())
    for (x, y, a) in ((10, 11, 120), (11, 10, 90), (12, 11, 120), (12, 13, 90), (9, 11, 70), (12, 12, 110)):
        if not im.getpixel((x, y))[3]:
            im.putpixel((x, y), C('ķ') + (a,))
    return im


def glow(strong):
    im = img(8, 8)
    core = C('ķ') if strong else lerp(C('ķ'), C('Ķ'), 0.4)
    for (x, y, c, a) in ((3, 3, core, 255), (4, 3, core, 255), (3, 4, core, 255), (4, 4, (255, 255, 220) if strong
                                                                                       else core, 255)):
        im.putpixel((x, y), c + (a,))
    halo = [(2, 3), (2, 4), (5, 3), (5, 4), (3, 2), (4, 2), (3, 5), (4, 5)]
    for (x, y) in halo:
        im.putpixel((x, y), C('Ķ') + (200 if strong else 120,))
    if strong:
        for (x, y) in ((1, 3), (6, 4), (3, 1), (4, 6)):
            im.putpixel((x, y), C('Ķ') + (90,))
    return im


def visitors_section():
    add('visitor.crane', crane(0))
    add('visitor.crane.1', crane(1))
    add('visitor.crane.flock', crane_flock(0))
    add('visitor.crane.flock.1', crane_flock(1))
    add('visitor.redDeer', red_deer(0))
    add('visitor.redDeer.1', red_deer(1))
    add('visitor.oriole', oriole(0))
    add('visitor.oriole.1', oriole(1))
    add('visitor.beaver', beaver(0))
    add('visitor.beaver.1', beaver(1))
    add('view.beaverDam', beaver_dam())
    add('visitor.glowworms', glowworm_icon())
    add('fx.glow', glow(True))
    add('fx.glow.1', glow(False))


# ===========================================================================
# 4. Indices des visiteurs (16 × 16)

def hint_trumpet():
    im = img(16, 16)
    for y in range(1, 15):
        for x in range(1, 15):
            im.putpixel((x, y), lerp(C('c'), C('w'), y / 18) + (255,))
    for x in range(16):
        im.putpixel((x, 0), OUT + (255,)); im.putpixel((x, 15), OUT + (255,))
        im.putpixel((0, x), OUT + (255,)); im.putpixel((15, x), OUT + (255,))
    # deux croches et une noire, petits oiseaux au loin
    for (x, y) in ((3, 9), (4, 9), (3, 10), (4, 10), (8, 7), (9, 7), (8, 8), (9, 8)):
        put(im, x, y, 'Z')
    for y in range(3, 9):
        put(im, 5, y, 'Z')
    for y in range(2, 7):
        put(im, 10, y, 'Z')
    for x in range(5, 11):
        put(im, x, 2 + (0 if x < 6 else 0) + (1 if x < 8 else 0) - (1 if x >= 10 else 0), 'Z')
    for (x, y) in ((11, 10), (12, 10), (11, 11), (12, 11)):
        put(im, x, y, 'Z')
    for y in range(6, 11):
        put(im, 13, y, 'Z')
    for (x, y) in ((3, 4), (4, 5), (5, 4)) if False else ():
        put(im, x, y, 'Z')
    return im


def hint_antler():
    """Bois de cerf tombé dans l'herbe : merrain courbe, andouillers dressés, meule à la base."""
    return icon("""
................
................
..........[.....
..........[.[...
.....[....[[]...
.....[...[[]....
...[.[..[[].....
...[[]..[]......
....[[.[[]......
.....[[[].......
......[[].......
.....[]]........
...kVV]...G.j...
..GjVVGjGjGGjG..
.jGGjGGGjGGjGGj.
................
""")


def hint_gnawed():
    g = Grid(16, 16)
    # branche de saule rongée en pointe, copeaux
    g.line(2, 12, 10, 6, '¥')
    g.line(2, 13, 10, 7, 'J')
    g.stamp(['(b', '(((', '((b'], 10, 4)
    g.set(13, 5, '('); g.set(14, 5, 'b')
    for (x, y) in ((4, 15), (8, 14), (11, 13), (13, 14)):
        g.set(x, y, '(')
    g.stamp(['µ.', '¥µ'], 3, 9)
    return icon(g.rows())


def hint_flute():
    """Plume jaune d'or du loriot (bout noir)."""
    return icon("""
................
............ZZ..
...........ZZZ..
..........iyZZ..
.........iyyZ...
........iyyyY...
.......iyyyY....
......iyyyY.....
.....iyyyY......
....iyyyY.......
....iyyY........
....yyY.........
....NY..........
...N............
..N.............
................
""")


def hint_glow():
    """Petite lueur verte au pied d'une herbe."""
    g = Grid(16, 16)
    for (x, y) in ((6, 15), (6, 14), (6, 13), (7, 12), (7, 11), (7, 10), (8, 9), (8, 8), (9, 7)):
        g.set(x, y, 'D')
    for (x, y) in ((10, 15), (10, 14), (11, 13), (11, 12), (12, 11)):
        g.set(x, y, 'd')
    g.stamp(['ķķ', 'ķķ'], 7, 13)
    im = icon(g.rows())
    for (x, y) in ((4, 12), (5, 11), (4, 13), (3, 14), (9, 12), (10, 12), (5, 15), (9, 11), (5, 12), (8, 11)):
        if not im.getpixel((x, y))[3]:
            im.putpixel((x, y), C('ķ') + (130,))
    for (x, y) in ((3, 12), (2, 13), (11, 11), (12, 13), (4, 10), (10, 10)):
        if not im.getpixel((x, y))[3]:
            im.putpixel((x, y), C('ķ') + (70,))
    return im


def hints_section():
    add('visitor.hint.trumpet', hint_trumpet())
    add('visitor.hint.antler', hint_antler())
    add('visitor.hint.gnawed', hint_gnawed())
    add('visitor.hint.flute', hint_flute())
    add('visitor.hint.glow', hint_glow())


# ===========================================================================
# 5. Forêt de la carte : feuillus qui se raccordent à la forêt de Tiny Town, vieux arbres, fougères

FILL = TOWN.crop((7 * 16, 1 * 16, 8 * 16, 2 * 16)).convert('RGBA')


def leafy_tile(ramp, trunk='N', bark=None, blossom=None, shape=(8.0, 7.0, 6.8, 6.0), seed=0):
    """Tuile de forêt pleine (forest.green.fill) dont l'arbre du milieu devient un feuillu rond et large : les
    bords (moitiés d'arbres voisins) restent ceux de Tiny Town, la tuile se raccorde à ses voisines."""
    im = FILL.copy()
    g = Grid(16, 16)
    cx, cy, rx, ry = shape
    tx = int(cx) - 1
    for y in range(int(cy + ry) - 2, 16):
        g.set(tx, y, bark or trunk)
        g.set(tx + 1, y, trunk if not bark else ('Z' if y % 3 == 0 else bark))
    rnd = random.Random(seed)
    g.ball(cx, cy, rx, ry, ramp, ring='A')
    for (dx, dy, r) in ((-3.0, 1.6, 0.5), (3.0, 1.4, 0.5), (-0.6, -2.6, 0.5)):
        g.ball(cx + dx, cy + dy, rx * r, ry * r, ramp, ring='A')
    if blossom:
        for (x, y) in g.cells_ellipse(cx, cy, rx, ry):
            if g.get(x, y) in ramp and rnd.random() < 0.3:
                g.set(x, y, blossom[rnd.randrange(len(blossom))])
    top = art(g.rows(), outline=1, w=16, h=16)
    im.alpha_composite(top)
    return im


def old_tree_tile(variant):
    """Vieil arbre moussu : tronc large aux racines, couronne qui déborde de la tuile."""
    im = FILL.copy()
    g = Grid(16, 16)
    x0 = 5 if variant == 0 else 4
    ramp = '«D7¤' if variant == 0 else 'GD7¤'
    g.ball(8, 5.2, 7.6, 5.4, ramp, ring='A')
    g.ball(3.8, 6.8, 3.6, 2.8, ramp, ring='A')
    g.ball(12.2, 6.4, 3.6, 3.0, ramp, ring='A')
    g.rect(x0, 10, x0 + 5, 15, 'U')
    g.rect(x0 + 4, 10, x0 + 5, 15, '~')
    g.rect(x0, 10, x0 + 1, 13, '³')
    for y in range(11, 15, 2):
        g.set(x0 + 2, y, '³')
    g.set(x0 - 1, 15, 'U'); g.set(x0 + 6, 15, '~'); g.set(x0 - 1, 14, '³')
    if variant == 1:
        g.set(x0 + 2, 12, 'Z'); g.set(x0 + 3, 12, 'Z'); g.set(x0 + 3, 13, 'Z')   # creux du vieux tronc
    for (x, y) in ((4, 3), (10, 2), (7, 6), (12, 5)):
        if g.get(x, y) in ramp:
            g.set(x, y, '³')                                   # mousse et lichens
    top = art(g.rows(), outline=1, w=16, h=16)
    im.alpha_composite(top)
    return im


def fern_tile():
    """Sous-bois de fougères : l'arbre du milieu laisse place à une trouée sombre pleine de fougères."""
    im = FILL.copy()
    px = im.load()
    inside = set(ellipse(8, 9, 5.6, 4.6))
    for (x, y) in inside:
        if 0 <= x < 16 and 0 <= y < 16:
            px[x, y] = C('7') + (255,)
    for (x, y) in inside:
        for (dx, dy) in ((0, -1), (-1, 0), (1, 0), (0, 1)):
            q = (x + dx, y + dy)
            if q not in inside and 0 <= q[0] < 16 and 0 <= q[1] < 16:
                px[q] = OUT + (255,)
    # cinq frondes : tige claire, folioles alternées
    for (cx, base, h, s) in ((5, 13, 5, -1), (8, 13, 6, 1), (11, 13, 5, 1), (7, 11, 3, -1), (10, 11, 3, 1)):
        for k in range(h):
            x = cx + (k * s) // 3
            y = base - k
            put(im, x, y, 'D')
            if k % 2 == 0 and k < h - 1:
                put(im, x - 1, y, '«'); put(im, x + 1, y, '«')
            elif k < h - 1:
                put(im, x - 1, y + 1, 'G'); put(im, x + 1, y + 1, 'G')
    return im


def forest_section():
    add('forest.mixed.oak', leafy_tile('«D7', seed=1))
    add('forest.mixed.beech', leafy_tile('gGD', shape=(8.0, 6.6, 5.6, 6.4), seed=2))
    add('forest.mixed.birch', leafy_tile('µ¥J', trunk='¶', bark='¶', shape=(8.0, 6.2, 5.4, 5.6), seed=3))
    add('forest.mixed.cherry', leafy_tile('GD7', trunk='H', shape=(8.0, 7.0, 6.8, 5.6), seed=4))
    add('forest.mixed.cherry.bloom', leafy_tile('GD7', trunk='H', blossom='wwÆ', shape=(8.0, 7.0, 6.8, 5.6), seed=4))
    add('forest.old.0', old_tree_tile(0))
    add('forest.old.1', old_tree_tile(1))
    add('forest.fern', fern_tile())


# ===========================================================================
# 6. Objets de la vue et de la ferme

def village_lights():
    g = Grid(16, 16)
    # deux façades serrées, toits d'ardoise sombre, fenêtres jaunes allumées
    g.rect(0, 6, 7, 15, 'x'); g.rect(6, 6, 7, 15, 'z')
    for i in range(4):
        g.rect(i, 5 - i, 7 - i, 5 - i, 'Z')
    g.rect(8, 8, 15, 15, 'M'); g.rect(14, 8, 15, 15, 'x')
    for i in range(4):
        g.rect(8 + i, 7 - i, 15 - i, 7 - i, 'Z')
    for (x, y) in ((1, 8), (4, 8), (1, 12), (9, 10), (12, 10), (12, 13)):
        g.rect(x, y, x + 1, y + 1, 'y')
        g.set(x, y, 'i')
    g.rect(4, 12, 5, 15, 'N')
    return icon(g.rows())


JOSEPH_SEATED = """
................
.....JJJJJ......
....JJJJJJd.....
....dddddddd....
.....fZffZ......
.....WWWWW......
....RqWWWqR.....
...RRqRRqRRR....
...fRRqRRqRf...N
...fNNNNNNNf..N.
....NNNNNNN..N..
....NN...NN.N...
....NN...NNN....
....xx...xx.....
................
................
"""

HELENE_SEATED = """
................
......KKK.......
.....KKKKK......
.....KlllK......
.....lZlZl......
......lll.......
.....ØØNØø......
....ØØØØØøø.....
....lØ&&&øl.....
....ØØ&Z&øø.....
.....ØØØØø......
.....xx.xx......
.....xx.xx......
.....ZZ.ZZ......
................
................
"""


def seated(rows, extra=None):
    pal = dict(PAL)
    if extra:
        pal.update(extra)
    return art(rows_of(rows), outline=1, w=16, h=16, pal=pal)


def valley_box_gift():
    base = VALLEY1.crop((2 * 16, 16 * 16, 3 * 16, 17 * 16))
    im = base.copy()
    # ruban doré noué (croix) et un nœud sur le dessus
    for y in range(4, 15):
        for x in (7, 8):
            if im.getpixel((x, y))[3] and im.getpixel((x, y))[:3] != OUT:
                im.putpixel((x, y), C('y' if x == 7 else 'Y') + (255,))
    for x in range(2, 14):
        if im.getpixel((x, 10))[3] and im.getpixel((x, 10))[:3] != OUT:
            im.putpixel((x, 10), C('y') + (255,))
    bow = ['.yy..yy.', 'yiyyyiyy', '.yyYYyy.', '..Y..Y..']
    for y, line in enumerate(bow):
        for x, ch in enumerate(line):
            if ch != '.':
                put(im, 4 + x, 1 + y, ch)
    ring_out(im, [(4 + x, 1 + y) for y, l in enumerate(bow) for x, ch in enumerate(l) if ch != '.' and y < 2])
    return im


def view_section():
    add('view.village.lights', village_lights())
    add('view.joseph.seated', seated(JOSEPH_SEATED, {'J': PAL['J'], 'd': PAL['d']}))
    add('view.helene.seated', seated(HELENE_SEATED, {'K': (196, 196, 204)}))
    add('valley.box.gift', valley_box_gift())


# ===========================================================================
# 7. Vignettes des récits, de l'épilogue (48 × 32) et vallée de l'étape 8 (96 × 48)

vignette_bg = v3m.vignette_bg
finish = v3m.finish
sky = v2.sky


def fig_joseph(front=True):
    """Joseph debout, petit (8 × 14) : casquette, barbe blanche, chemise à carreaux, salopette."""
    return ['.JJJJJ..', 'JJJJJJd.', '.ffffff.', '.fZffZ..', '.WWWWW..', 'RqWWWqR.', 'RRqRRqRR', 'fRNNNNRf',
            '.NNNNNN.', '.NNNNNN.', '.NN..NN.', '.NN..NN.', '.xx..xx.', '........']


def fig_farmer():
    return ['..kkkk...', 'bkkkkkkb.', '..ffff...', '..fZfZ...', '..ffff...', '.CCCCCC..', 'COOCCOOC.', 'fOOOOOOf.',
            '.OOOOOO..', '.OOOOOO..', '.xx..xx..', '.xx..xx..', '.ZZ..ZZ..', '.........']


def fig_helene():
    return ['..KKK...', '.KKKKK..', '.KlllK..', '.lZlZl..', '..lll...', '.ØØNØø..', 'ØØØØØøø.', 'lØ&&&øl.',
            '.ØØØØø..', '.ØØØØø..', '.xx.xx..', '.xx.xx..', '.ZZ.ZZ..', '........']


FIG_PAL = {'K': (196, 196, 204)}


def stamp_fig(im, rows, x, y, flip_=False):
    pal = dict(PAL)
    pal.update(FIG_PAL)
    if flip_:
        rows = [r[::-1] for r in rows]
    w = max(len(r) for r in rows)
    f = g3.art(rows, outline=1, pal=pal, w=w + 2, h=len(rows) + 2) if False else None
    g = Grid(w + 2, len(rows) + 2)
    g.stamp(rows, 1, 1)
    f = g3.art(g.rows(), outline=1, pal=pal, w=w + 2, h=len(rows) + 2)
    im.alpha_composite(f, (x - 1, y - 1)) if x >= 1 and y >= 1 else im.paste(f, (x - 1, y - 1), f)


def mini_stork_img(flying=True):
    """Petite cigogne lointaine (vignettes), sans contour : ailes noires en V, corps blanc, bec et pattes rouges."""
    rows = ['ZZ.......ZZ', '.ZZw...wZZ.', '..ZwwwwwZ..', 'ĺwwwwwwwwsĺ'] if flying else \
        ['ĺĺw.', '..w.', '..ww', '.wwZ', '.wZZ', '..ĺ.']
    im = img(max(len(r) for r in rows), len(rows))
    for y, line in enumerate(rows):
        for x, ch in enumerate(line):
            if ch != '.':
                put(im, x, y, ch)
    return im


def steeple_small(g, x, y, snow=False):
    """Petit clocher (7 × 14) posé en (x, y) = haut de la flèche."""
    for i in range(5):
        g.rect(x + 3 - i // 2, y + i, x + 3 + (i + 1) // 2, y + i, 'z' if not snow else 'W')
    g.rect(x + 1, y + 5, x + 5, y + 13, '[')
    g.rect(x + 4, y + 5, x + 5, y + 13, ']')
    g.rect(x + 2, y + 7, x + 3, y + 8, 'Z')
    g.set(x + 3, y - 1, 'Y'); g.set(x + 2, y, 'Y') if False else None


def hills(g, base, amp, period, ch, ch2=None, phase=0.0):
    for x in range(g.w):
        top = int(base + amp * math.sin(x / period + phase))
        for y in range(top, g.h):
            g.set(x, y, ch if (ch2 is None or y > top) else ch2)


def story_melon():
    """La boîte ouverte, trois graines gonflées sur un linge."""
    g = Grid(48, 32)
    g.rect(0, 0, 47, 31, 'b')                                 # table de bois
    for y in (6, 13, 20, 27):
        g.rect(0, y, 47, y, 'B')
    for (x, y) in ((7, 3), (30, 9), (14, 17), (40, 24), (22, 29)):
        g.set(x, y, 'n')
    # boîte en fer ouverte (à gauche)
    g.rect(2, 4, 17, 15, '@'); g.rect(3, 5, 16, 14, '!')
    g.rect(4, 7, 15, 13, '(')
    g.stamp(['((E(', '(()(', ')))(('], 5, 8)
    g.stamp(['(N((', '((((', ')))('], 10, 9)
    g.set(9, 6, 'K'); g.set(13, 5, 'y')
    # linge blanc à carreaux bleus, trois graines gonflées
    g.rect(21, 12, 45, 28, 'w')
    for x in range(21, 46, 4):
        g.rect(x, 12, x, 28, 'c')
    for y in range(12, 29, 4):
        g.rect(21, y, 45, y, 'c')
    for (x, y) in ((27, 18), (33, 21), (38, 17)):
        g.stamp(['.ĉĉ.', 'ĉĉĉĈ', 'ĉĉĈĈ', '.ĈĈ.'], x, y)
        g.set(x + 1, y + 1, 'w')
    g.stamp(['.d', 'dG'], 34, 19)
    im = art(g.rows(), outline=0, w=48, h=32)
    return frame_border(im)


def story_mill():
    """Joseph devant le coffre à grain ouvert du moulin."""
    g = Grid(48, 32)
    g.rect(0, 0, 47, 31, 'U')                                 # intérieur du moulin : planches sombres
    for x in range(0, 48, 6):
        g.rect(x, 0, x, 22, '}')
    g.rect(0, 23, 47, 31, 'V')                                # plancher
    for y in (26, 29):
        g.rect(0, y, 47, y, '~')
    # rai de lumière par une lucarne
    g.rect(36, 2, 42, 7, 'c'); g.rect(39, 2, 39, 7, 'U'); g.rect(36, 4, 42, 4, 'U')
    # coffre à grain ouvert : couvercle relevé, grain doré
    g.rect(22, 14, 43, 26, 'B'); g.rect(22, 14, 43, 15, 'b'); g.rect(42, 14, 43, 26, 'n')
    g.rect(24, 16, 41, 18, 'ĝ')
    for x in range(24, 42, 2):
        g.set(x, 17, 'Ĝ')
    g.rect(22, 6, 43, 8, 'b'); g.rect(22, 9, 43, 9, 'n')     # couvercle
    g.rect(22, 9, 22, 14, 'N'); g.rect(43, 9, 43, 14, 'N')
    for (x, y) in ((30, 20), (34, 23), (38, 21)):
        g.set(x, y, 'n')
    im = art(g.rows(), outline=0, w=48, h=32)
    for k in range(3):                                        # poussière de farine dans la lumière
        for y in range(8, 30):
            blend_px(im, int(38 - y * 0.45 + k * 2), y, (255, 244, 200), 0.18)
    stamp_fig(im, fig_joseph(), 9, 12)
    setpx(im, [(19, 20), (20, 19), (21, 18)], 'f')            # bras tendu vers le coffre
    return frame_border(im)


def story_marvel():
    """Une tomate rayée d'or sur une assiette."""
    g = Grid(48, 32)
    g.rect(0, 0, 47, 31, 'k')                                 # nappe
    for x in range(0, 48, 4):
        for y in range(0, 32, 4):
            g.set(x, y, 'E'); g.set(x + 1, y + 1, 'E')
    for (x, y) in g.cells_ellipse(24, 18, 17, 10):
        g.set(x, y, 's')
    for (x, y) in g.cells_ellipse(24, 18, 15, 8.6):
        g.set(x, y, 'w')
    for (x, y) in g.cells_ellipse(24, 18.5, 10, 5.6):
        g.set(x, y, 'W')
    g.ball(24, 15.5, 8.0, 7.0, 'yyY', ring='A')
    for (x, y) in g.cells_ellipse(24, 15.5, 8.0, 7.0):
        if (x * 2 + y // 3) % 6 in (0, 1):
            g.set(x, y, 'ĥ' if x < 25 else 'Ĥ')
    g.stamp(['.D.D.', 'DDdDD', '..d..'], 22, 8)
    g.set(19, 12, 'w'); g.set(20, 11, 'w')
    # couteau à côté
    g.rect(38, 24, 46, 24, 's'); g.rect(42, 25, 46, 25, 'N')
    im = art(g.rows(), outline=0, w=48, h=32)
    return frame_border(im)


def story_peas():
    """Un sachet de toile, le clocher et deux cigognes au loin."""
    g = Grid(48, 32)
    sky(g, 48, 'c', 'v', 0, 16)
    hills(g, 15, 1.4, 6.0, 'J', 'G')
    steeple_small(g, 36, 4)
    g.rect(0, 22, 47, 31, 'G')
    im = art(g.rows(), outline=0, w=48, h=32)
    # sachet de toile écrue, col noué d'une ficelle, quelques pois devant
    bag = Grid(18, 18)
    bag.stamp(['....(...(.(....', '.....(((((.....', '......NNN......', '.....(((((.....', '...((((((()....',
               '..(((((((()).. ', '.((((((((((()).', '.(((((()((((()).', '((((((((((((())', '((((()(((((()))',
               '(((((((((((()))', '.(((((((((())).', '..))))))))))))..'], 1, 1)
    im.alpha_composite(obj(bag), (5, 13))
    pea = Grid(10, 4)
    pea.stamp(['ĵĵ.ĵĴ', '.ĵĴ.ĵ'], 1, 1)
    im.alpha_composite(obj(pea), (22, 26))
    for (x, y) in ((30, 3), (40, 1)):
        im.alpha_composite(mini_stork_img(True), (x, y))
    return frame_border(im)


def story_storks():
    """Deux cigognes sur le clocher (chapitre 8)."""
    g = Grid(48, 32)
    sky(g, 48, 'c', 'v', 0, 31)
    hills(g, 24, 1.2, 6.0, 'J', 'G')
    for (x, y, w) in ((2, 22, 10), (34, 21, 12)):              # toits du village
        for yy in range(3):
            g.rect(x + 2 - yy, y + yy, x + w - 2 + yy, y + yy, 'R' if yy % 2 else 'q')
        g.rect(x, y + 3, x + w, 31, 'k')
        g.set(x + 3, y + 5, 'c'); g.set(x + w - 3, y + 5, 'c')
    im = art(g.rows(), outline=0, w=48, h=32)
    st = stork_steeple()
    im.alpha_composite(st, (16, 8))
    im.alpha_composite(mini_stork_img(True), (32, 3))
    for (x, y) in ((4, 5), (40, 15)):
        setpx(im, [(x, y), (x + 1, y), (x + 2, y), (x + 3, y), (x + 1, y - 1), (x + 2, y - 1)], 'w')
    return frame_border(im)


def house_crop(level=1):
    H = [(27, 7, 4, 3), (27, 4, 5, 3), (18, 4, 5, 4), (12, 0, 6, 4), (0, 0, 6, 5)][level - 1]
    c, r, w, h = H
    return CAREER.crop((c * T, r * T, (c + w) * T, (r + h) * T))


def story_stork_nest():
    """Le nid sur la maison de la ferme."""
    g = Grid(48, 32)
    sky(g, 48, 'c', 'v', 0, 31)
    im = art(g.rows(), outline=0, w=48, h=32)
    house = house_crop(1)
    im.paste(house, (-8, 15), house)                       # le toit de la maison ; cheminée en x = 16, y = 18
    nest = stork_nest('pair')
    im.alpha_composite(nest, (4, 0))
    im.alpha_composite(mini_stork_img(True), (32, 5))
    return frame_border(im)


def epilogue_1():
    """La colline au soir, Joseph et le fermier assis, la vallée verte."""
    g = Grid(48, 32)
    sky(g, 48, 'y', 'i', 0, 12)
    g.rect(0, 0, 47, 3, 'r')
    for y in range(9, 20):
        for x in range(48):
            if y >= 11 + 2 * math.sin(x / 6.0):
                g.set(x, y, 'd' if (x + y) % 5 else 'D')
    for x in range(48):
        y = 15 + int(2 * math.sin(x / 5.0))
        g.set(x, y, 'C'); g.set(x, y + 1, 'c' if x % 3 else 'C')
    for y in range(20, 32):
        for x in range(48):
            if y >= 20 + (x - 24) ** 2 / 120:
                g.set(x, y, 'G' if y > 22 else 'j')
    g.stamp(['..JJJJ..', '.JJJJJJ.', 'dddddddd', '.WWWWW..', '.WWWWW..', 'qRRqRRqR', 'RqRRqRRq', 'RRqRRqRR',
             'qRRqRRqR', 'xxxxxxxx', 'xx....xx'], 12, 13)
    g.stamp(['...kk.....', '..kkkk....', 'bkkkkkkkkb', '..NNNN....', '..NNNN....', '.CCCCCC...', 'CCOCCOCC..',
             'CCOCCOCC..', 'CCOOOOCC..', 'xxxxxxxx..', 'xx....xx..'], 24, 13)
    im = art(g.rows(), outline=0, w=48, h=32)
    for (x, y) in ((40, 4), (43, 6)):
        setpx(im, [(x, y), (x + 4, y)], 'Z')
        setpx(im, [(x + 1, y + 1), (x + 2, y + 1), (x + 3, y + 1)], 'w')
    return frame_border(im)


def epilogue_2():
    """Joseph tend la boîte en fer."""
    g = Grid(48, 32)
    sky(g, 48, 'y', 'i', 0, 18)
    g.rect(0, 19, 47, 31, 'G')
    im = art(g.rows(), outline=0, w=48, h=32)
    p = CAREER.crop((20 * T, 24 * T, 22 * T, 26 * T))                 # portrait.joseph (content)
    im.alpha_composite(p, (4, 0))
    box = valley_box_gift()
    im.alpha_composite(box.resize((24, 24), Image.NEAREST), (22, 8))
    setpx(im, [(21, 22), (22, 22), (21, 23), (46, 22)], 'f')
    return frame_border(im)


def epilogue_3():
    """Joseph et Hélène sur le banc, le fermier qui redescend vers la ferme."""
    g = Grid(48, 32)
    sky(g, 48, 'y', 'i', 0, 10)
    hills(g, 9, 1.0, 7.0, 'd', 'D')
    g.rect(0, 16, 47, 31, 'G')
    for y in range(16, 32):                                          # chemin qui descend
        x = int(30 + (y - 16) * 0.9)
        g.rect(x, y, x + 3, y, 'k')
    im = art(g.rows(), outline=0, w=48, h=32)
    bench = v3m.view_bench()
    im.alpha_composite(bench, (0, 12))
    im.alpha_composite(get('view.joseph.seated'), (4, 6))
    im.alpha_composite(get('view.helene.seated'), (14, 6))
    stamp_fig(im, fig_farmer(), 37, 17, flip_=True)
    house = house_crop(1).resize((16, 12), Image.NEAREST)
    im.alpha_composite(house, (30, 4))
    return frame_border(im)


def valley_stage8():
    im = v3m.valley_stage(7).copy()
    px = im.load()
    W, H = im.size
    rnd = random.Random(88)
    # printemps : fleurs blanches et jaunes dans les prés, arbres en fleurs
    for _ in range(50):
        x, y = rnd.randint(3, W - 4), rnd.randint(24, H - 3)
        p = px[x, y][:3]
        if p not in (PAL['C'], PAL['c'], PAL[':']) and p != OUT:
            px[x, y] = C(rnd.choice(('w', 'w', 'y', 'Æ'))) + (255,)
    # petit clocher du village au fond à droite, deux cigognes au-dessus
    g = Grid(9, 16)
    steeple_small(g, 1, 1)
    st = obj(g)
    im.alpha_composite(st, (80, 14))
    for (x, y) in ((70, 4), (82, 2)):
        im.alpha_composite(mini_stork_img(True), (x, y))
    return frame_border(im)


def vignettes_section():
    add('story.melon', story_melon())
    add('story.mill', story_mill())
    add('story.marvel', story_marvel())
    add('story.peas', story_peas())
    add('story.storks', story_storks())
    add('story.storkNest', story_stork_nest())
    add('story.epilogue.1', epilogue_1())
    add('story.epilogue.2', epilogue_2())
    add('story.epilogue.3', epilogue_3())
    add('valley.stage.8', valley_stage8())


# ===========================================================================
# 8. Cartes postales des vallées voisines (48 × 32 : bord blanc, timbre au coin)

def postcard(scene_fn, stamp_col):
    g = Grid(48, 32)
    scene_fn(g)
    im = art(g.rows(), outline=0, w=48, h=32)
    extra = getattr(scene_fn, 'extra', None)
    if extra:
        extra(im)
    # bord blanc (2 px) puis contour
    px = im.load()
    for y in range(32):
        for x in range(48):
            if x < 3 or y < 3 or x > 44 or y > 28:
                px[x, y] = (250, 248, 240, 255)
    # timbre dentelé en haut à droite
    for y in range(4, 12):
        for x in range(36, 44):
            edge = x in (36, 43) or y in (4, 11)
            if edge and (x + y) % 2:
                px[x, y] = (250, 248, 240, 255)
            else:
                px[x, y] = C(stamp_col) + (255,) if edge or (x + y) % 5 else C('w') + (255,)
    for x in range(38, 42):
        px[x, 7] = C('w') + (255,)
        px[x, 8] = C('y') + (255,)
    return frame_border(im)


def pc_land(g, horizon=14, ground='G', top='c', bot='v'):
    sky(g, 48, top, bot, 0, horizon)
    g.rect(0, horizon + 1, 47, 31, ground)


def pc1(g):
    """Barrière, merle, pois à rames."""
    pc_land(g)
    for x in range(4, 30, 6):
        g.rect(x, 12, x, 24, 'N')
    g.rect(3, 15, 30, 15, 'B'); g.rect(3, 20, 30, 20, 'B')
    for x in (33, 37, 41):
        g.line(x, 26, x + 2, 10, 'U')
        for y in range(12, 26, 3):
            g.set(x + (26 - y) // 8, y, 'ĵ'); g.set(x + 1 + (26 - y) // 8, y + 1, 'Ĵ')
    g.stamp(['.ZZ.', 'ZZZY', '.ZZ.', 'ZZ..'], 14, 9)


def pc2(g):
    """Cloches dans un potager en pente."""
    pc_land(g, horizon=8)
    for y in range(9, 32):
        g.rect(0, y, 47, y, 'b' if (y // 4) % 2 else 'n')
    for y in range(12, 32, 8):
        for x in range(4, 44, 7):
            g.rect(x, y - 3, x + 3, y, '!')
            g.rect(x + 1, y - 4, x + 2, y - 4, '!')
            g.set(x + 1, y - 2, 'w')
            g.set(x + 2, y - 1, 'D')


def pc3(g):
    """Haie neuve et hérisson."""
    pc_land(g, horizon=12)
    for x in range(0, 48, 5):
        for (xx, yy) in g.cells_ellipse(x + 2.5, 16, 3.2, 3.6):
            g.set(xx, yy, 'D' if (xx + yy) % 3 else 'd')
        g.rect(x + 2, 19, x + 2, 21, 'N')
    g.stamp(['..;;;;..', '.;~;~;;.', ';;~;~;;;', 'k;;;;;;;', '.Z.Z.Z..'], 18, 22)
    g.set(18, 25, 'Z')


def pc4(g):
    """Source entre des pierres."""
    pc_land(g, horizon=10, ground='J')
    for (x, y, r) in ((10, 18, 5), (30, 16, 6), (20, 22, 4), (38, 22, 4)):
        for (xx, yy) in g.cells_ellipse(x, y, r, r * 0.7):
            g.set(xx, yy, '[' if yy < y else ']')
    for y in range(18, 32):
        x = int(22 + 3 * math.sin(y / 3.0))
        g.rect(x, y, x + 3 + (y - 18) // 4, y, 'C')
        g.set(x + 1, y, 'c')


def pc5(g):
    """Moulin et miche."""
    pc_land(g, horizon=18)
    g.rect(8, 6, 17, 22, '[')
    g.rect(15, 6, 17, 22, ']')
    for i in range(4):
        g.rect(7 + i, 5 - i, 18 - i, 5 - i, 'R')
    for (x0, y0, x1, y1) in ((12, 8, 3, 0), (12, 8, 21, 0), (12, 8, 3, 16), (12, 8, 21, 16)):
        g.line(x0, y0, x1, y1, 'V')
    g.rect(11, 18, 13, 22, 'N')
    for (xx, yy) in g.cells_ellipse(33, 22, 9, 5):
        g.set(xx, yy, 'B' if yy < 21 else 'n')
    for x in (28, 32, 36):
        g.line(x, 19, x + 2, 21, 'k')


def pc6(g):
    """Pré de coquelicots et silhouette aux jumelles."""
    pc_land(g, horizon=13)
    rnd = random.Random(6)
    for _ in range(90):
        g.set(rnd.randint(0, 47), rnd.randint(15, 31), 'E')
    g.stamp(['.ZZ.', 'ZZZZ', '.ZZ.', 'ZZZZ', 'ZZZZ', 'ZZZZ', '.ZZ.', '.ZZ.', 'Z..Z'], 32, 10)
    g.set(30, 11, 'Z'); g.set(31, 11, 'Z')


def pc7(g):
    """Chevreuil dans un verger au petit jour."""
    pc_land(g, horizon=16, top='Æ', bot='i')
    for x in (4, 18, 38):
        for (xx, yy) in g.cells_ellipse(x + 4, 9, 5, 4):
            g.set(xx, yy, 'D' if (xx + yy) % 4 else 'd')
        g.rect(x + 4, 12, x + 4, 18, 'N')
        g.set(x + 2, 8, 'w'); g.set(x + 6, 10, 'w')
    g.stamp(['.n...', 'nnn..', '.nn..', '.nnnnnnn', '.nnnnnnn', '.n.n..n.n', '.n.n..n.n'], 24, 17)
    g.set(25, 19, 'Z')


def pc8(g):
    """Clocher et cigogne."""
    pc_land(g, horizon=22)
    steeple_small(g, 10, 6)
    g.rect(0, 23, 47, 31, 'G')
    for x in range(0, 48, 9):
        g.rect(x, 18, x + 6, 22, 'k')
        g.rect(x, 16, x + 6, 17, 'R')


def pc8_extra(im):
    im.alpha_composite(mini_stork_img(True), (22, 8))


pc8.extra = pc8_extra


def postcards_section():
    cols = ['E', 'C', 'D', ':', 'Y', 'E', 'P', 'C']
    for i, fn in enumerate((pc1, pc2, pc3, pc4, pc5, pc6, pc7, pc8)):
        add(f'postcard.{i + 1}', postcard(fn, cols[i]))


# ===========================================================================
# 9. Le livre : couverture (64 × 80), signet (8 × 24)

LINDEN_LEAF = """
.........y..........
........yy..........
.......yyyy.........
.....yyyyyyyy.......
...yyyyyyyyyyyy.....
..yyyyyyyyyyyyyy....
.yyyyyyyyYyyyyyyy...
.yyyyYyyyYyyyYyyyy..
yyyyyyYyyYyyYyyyyY..
yyyyyyyYyYyYyyyyyY..
yyyyyyyyYYYyyyyyYY..
.yyyyyyyyYyyyyyYYY..
.yyyyyyyyYyyyyYYY...
..YyyyyyyYyyyYYYY...
...YYyyyyYyYYYYY....
.....YYYYYYYYY......
.........Y..........
.........Y..........
..........Y.........
"""


def book_cover():
    """Toile verte, coins de cuir, filet et feuille de tilleul dorés ; le titre est écrit par le code dans le haut
    (entre y = 12 et y = 40)."""
    W, H = 64, 80
    im = img(W, H)
    px = im.load()
    for y in range(H):
        for x in range(W):
            c = C('ń')
            if (x + y) % 4 == 0:
                c = lerp(C('ń'), C('Ń'), 0.45)                       # trame de la toile, discrète
            elif (x - y) % 4 == 0:
                c = lerp(C('ń'), C('ņ'), 0.35)
            if x < 7:
                c = C('Ń') if x not in (3, 4) else lerp(C('ń'), C('Ń'), 0.3)   # dos du livre
            px[x, y] = c + (255,)
    for y in range(4, H - 4, 12):                                    # nervures du dos
        for x in range(1, 6):
            px[x, y] = C('Y') + (255,)
    # coins de cuir (triangles), bord plus clair
    for (cx, cy, sx, sy) in ((W - 1, 0, -1, 1), (W - 1, H - 1, -1, -1)):
        for d in range(11):
            for k in range(11 - d):
                x, y = cx + sx * k, cy + sy * d
                px[x, y] = (C('H') if k + d == 10 else C('N')) + (255,)
    # filet doré
    for x in range(11, W - 5):
        px[x, 5] = C('Y') + (255,); px[x, H - 6] = C('Y') + (255,)
    for y in range(5, H - 5):
        px[11, y] = C('Y') + (255,); px[W - 6, y] = C('Y') + (255,)
    # feuille de tilleul dorée
    rows = rows_of(LINDEN_LEAF)
    for y, line in enumerate(rows):
        for x, ch in enumerate(line):
            if ch != '.':
                px[27 + x, 46 + y] = C(ch) + (255,)
    leaf_pts = [(27 + x, 46 + y) for y, l in enumerate(rows) for x, ch in enumerate(l) if ch != '.']
    lp = set(leaf_pts)
    for (x, y) in leaf_pts:                                          # ombre portée de la dorure
        q = (x + 1, y + 1)
        if q not in lp:
            px[q] = C('Ń') + (255,)
    # tranche
    for y in range(H):
        px[0, y] = OUT + (255,); px[W - 1, y] = OUT + (255,)
    for x in range(W):
        px[x, 0] = OUT + (255,); px[x, H - 1] = OUT + (255,)
    for y in range(1, H - 1):
        px[7, y] = OUT + (255,)
    return im


def book_ribbon():
    im = img(8, 24)
    for y in range(24):
        for x in range(2, 6):
            c = 'E' if x < 4 else 'q'
            if y > 19 and ((x < 4 and y - 19 > x - 1) or (x >= 4 and y - 19 > 6 - x)):
                continue
            put(im, x, y, c)
    pts = [(x, y) for y in range(24) for x in range(8) if im.getpixel((x, y))[3]]
    ring_out(im, pts)
    return im


def book_section():
    add('book.cover', book_cover())
    add('book.ribbon', book_ribbon())


# ===========================================================================
# 10. Pictogrammes, onglets d'album, décors, succès

def icon_legend():
    return legend_jar()


def icon_visitor():
    """Plume blanche et noire (rémige de cigogne)."""
    return icon("""
................
...........ZZ...
..........ZZZZ..
.........wZZZZ..
........wwwZZ...
.......wwwwZ....
......wwwwss....
.....wwwwss.....
....wwwwss......
...wwwwss.......
...wwwss........
...wwss.........
...Ns...........
..N.............
.N..............
................
""")


def icon_book():
    g = Grid(16, 16)
    g.rect(3, 2, 12, 13, 'ń')
    g.rect(3, 2, 4, 13, 'Ń')
    g.rect(5, 13, 12, 13, 'w')
    g.rect(5, 14, 12, 14, 'Ń')
    g.rect(7, 6, 10, 9, 'y')
    g.set(8, 5, 'y'); g.set(9, 10, 'Y'); g.set(10, 9, 'Y')
    g.rect(11, 1, 11, 4, 'E')
    return icon(g.rows())


def icon_postcard():
    g = Grid(16, 16)
    g.rect(1, 3, 14, 12, 'w')
    g.rect(2, 4, 8, 11, 'c')
    g.rect(2, 9, 8, 11, 'G')
    g.rect(10, 4, 13, 7, 'E')
    g.set(11, 5, 'w'); g.set(12, 6, 'y')
    for y in (9, 11):
        g.rect(10, y, 13, y, 'S')
    return icon(g.rows())


def icon_sound_nature():
    g = Grid(16, 16)
    # oreille et feuille
    g.stamp(['..ffff.', '.ffFFff', 'ffF..Ff', 'ff.FF.f', 'ff.F.ff', '.f..ff.', '.ff.f..', '..fff..',
             '...ff..'], 2, 3)
    g.stamp(['..DD', '.DjD', 'DjD.', 'dd..'], 11, 2)
    g.set(10, 6, 'd')
    for (x, y) in ((11, 9), (12, 10), (13, 9)):
        g.set(x, y, 'C')
    return icon(g.rows())


def album_legends():
    g = Grid(16, 16)
    g.ball(8, 11, 4.0, 2.8, 'ĉĉĈ')
    g.set(7, 10, 'w'); g.set(9, 11, 'w')
    im = icon(g.rows())
    # cloche de verre par-dessus
    for y in range(2, 14):
        half = 6 if y > 5 else [2, 4, 5, 6][min(3, y - 2)]
        for x in (8 - half, 7 + half):
            put(im, x, y, CLOCHE_EDGE)
        for x in range(9 - half, 7 + half):
            p = im.getpixel((x, y))
            if not p[3]:
                im.putpixel((x, y), CLOCHE_TINT + (90,))
    for x in range(6, 10):
        put(im, x, 1, CLOCHE_EDGE)
    for (x, y) in ((5, 4), (4, 5), (4, 6), (4, 7)):
        put(im, x, y, 'w')
    for x in range(1, 15):
        put(im, x, 14, 'n')
    pts = [(x, y) for y in range(16) for x in range(16) if im.getpixel((x, y))[3] and im.getpixel((x, y))[:3] in
           (CLOCHE_EDGE, C('n'))]
    ring_out(im, pts)
    return im


def album_visitors():
    rows = ['....ZZZZ........', '....ZwZZZ.......', '..ĺĺwwwwZ.......', '.....www........', '......ww........',
            '......www.......', '.....wwwwwww....', '.....wwwwwwZZZ..', '.....swwwZZZZZZ.', '......sswZZZZ...',
            '........ĺ..ĺ....', '........ĺ..ĺ....', '........ĺ..ĺ....', '.......ĺĺ.ĺĺ....']
    return icon(['................'] + rows + ['................'])


def decor_melon_cloche():
    g = Grid(16, 16)
    g.ball(8, 12, 4.6, 2.8, 'ĉĉĈ')
    g.set(6, 11, 'w'); g.set(9, 12, 'w'); g.set(11, 11, 'w')
    im = icon(g.rows())
    for y in range(2, 14):
        half = 6 if y > 5 else [2, 4, 5, 6][min(3, y - 2)]
        for x in (8 - half, 7 + half):
            put(im, x, y, CLOCHE_EDGE)
        for x in range(9 - half, 7 + half):
            p = im.getpixel((x, y))
            if p[3]:
                im.putpixel((x, y), lerp(p[:3], CLOCHE_TINT, 0.2) + (255,))
            else:
                im.putpixel((x, y), CLOCHE_TINT + (80,))
    for x in range(6, 10):
        put(im, x, 1, CLOCHE_EDGE)
    put(im, 7, 0, 'w'); put(im, 8, 0, 'w')
    for (x, y) in ((5, 4), (4, 5), (4, 6), (4, 7)):
        put(im, x, y, 'w')
    for x in range(1, 15):
        put(im, x, 14, 'n'); put(im, x, 15, 'N')
    pts = [(x, y) for y in range(16) for x in range(16) if im.getpixel((x, y))[:3] == CLOCHE_EDGE]
    ring_out(im, pts)
    return im


def decor_stork_vane():
    g = Grid(16, 16)
    g.rect(7, 9, 8, 15, 'N')
    g.rect(4, 13, 11, 13, 'N')
    g.stamp(['ĺĺĺww....', '...wZw...', '....wwwZZ', '....wwZZZ', '.....Z.Z.'], 2, 3)
    g.set(7, 8, 'y'); g.set(8, 8, 'y')
    g.rect(13, 3, 13, 6, 'S')
    return icon(g.rows())


def decor_iron_box():
    g = Grid(16, 16)
    g.rect(4, 12, 11, 12, 'B'); g.rect(4, 11, 11, 11, 'b')
    g.rect(5, 13, 5, 15, 'N'); g.rect(10, 13, 10, 15, 'N')
    g.rect(3, 4, 12, 4, '@'); g.rect(3, 5, 12, 6, '!'); g.rect(3, 7, 12, 10, '!')
    g.rect(3, 6, 12, 6, '@')
    g.set(5, 8, 'K'); g.set(9, 9, 'y'); g.set(11, 8, 'w')
    return icon(g.rows())


ACH_MOTIF = {
    'firstLegend': ['..CC..', '.C..C.', '.C.D.C', 'C.ĉĉ.C', 'CĉĉĈC.', 'nnnnnn'],
    'legendHarvest': ['..d...', '.ĉĉĉ..', 'ĉwĉĉĈ.', 'ĉĉwĈĈ.', '.ĈĈĈ..', '......'],
    'fourLegends': ['ĉĉ.ĝĝ', 'ĉĈ.Ĝĝ', '.....', 'ĥy.ĵĵ', 'yĥ.ĵĴ'],
    'storksBack': ['ZZ...ZZ', '.ZwwwZ.', 'ĺwwwwwĺ', '..ZwZ..', '.......'],
    'storkNest': ['ĺw..w', '.wZwZ', 'VVVVV', 'UVUVU', '..N..'],
    'rareVisitor': ['..ŀE.', '.ŀŀ..', '.ŀŀŀŀ', '..ŀŀZ', '..Z.Z'],
    'allVisitors': ['y.ŀ.ł', 'Z.Ŀ.Ł', '.....', '~.ķ.w', ';.Ķ.Z'],
    'valleyBook': ['ńńńńń', 'ńńyńń', 'ńyyyń', 'ńńyńń', 'wwwww'],
    'furtherAway': ['wwwwww', 'wcccEw', 'wcccww', 'wGGGsw', 'wwwwww'],
}


def icons_section():
    add('icon.legend', icon_legend())
    add('icon.visitor', icon_visitor())
    add('icon.book', icon_book())
    add('icon.postcard', icon_postcard())
    add('icon.sound.nature', icon_sound_nature())
    add('album.page.legends', album_legends())
    add('album.page.visitors', album_visitors())
    add('decor.melon.cloche', decor_melon_cloche())
    add('decor.stork.vane', decor_stork_vane())
    add('decor.iron.box', decor_iron_box())
    for aid, motif in ACH_MOTIF.items():
        add(f'icon.ach.{aid}', ach_icon(motif))


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


# ===========================================================================
# Assemblage

SECTIONS = [legends_section, storks_section, visitors_section, hints_section, forest_section, view_section,
            vignettes_section, postcards_section, book_section, icons_section]


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


HEADER = """// Lot V4 de La Vallée vivante (planche « valley4 », assets/sprites/valley4.png) : « Les cigognes », style Kenney.
// Légendes : legend.<motherMelon|millEinkorn|farmMarvel|storkPea>.icon ; legend.<id>.0 / .1 / .2 et legend.cloche
// (8 × 12 : sous la cloche de verre translucide, terre sur les 2 dernières lignes) ; legend.jar.
// Cigognes : visitor.whiteStork[.1] (16 × 24, pattes en bas), visitor.whiteStork.fly[.1] (32 × 16), stork.wheel
// (24 × 12) et stork.nest.<pair|chicks|snow> (24 × 20) au même pied (bas du poteau, x = 12), stork.steeple (16 × 24).
// Visiteurs : visitor.<crane|redDeer (32 × 32)|oriole|beaver>[.1], visitor.crane.flock[.1] (48 × 16),
// view.beaverDam (32 × 16), visitor.glowworms, fx.glow[.1] (8 × 8, halo par le code), visitor.hint.<trumpet|antler|
// gnawed|flute|glow>. Bêtes : regard vers la GAUCHE. Forêt de la carte : forest.mixed.<oak|beech|birch|cherry|
// cherry.bloom>, forest.old.0 / .1, forest.fern (tuiles pleines raccordées à forest.green.fill). Vue : valley.stage.8
// (96 × 48), view.village.lights, view.joseph.seated, view.helene.seated, valley.box.gift. Vignettes (48 × 32) :
// story.<melon|mill|marvel|peas|storks|storkNest>, story.epilogue.1 / .2 / .3, postcard.1 … 8. Livre : book.cover
// (64 × 80), book.ribbon (8 × 24). Pictogrammes : icon.<legend|visitor|book|postcard|sound.nature>,
// album.page.<legends|visitors>, decor.<melon.cloche|stork.vane|iron.box>, icon.ach.<id> (grisés par le code).
// Ajoutés à SPRITES ici même (Object.assign), après sa définition."""


def existing_names(src):
    """Noms de sprites déclarés ailleurs dans atlas.js (hors bloc valley4) : clés littérales et alias écrits en dur."""
    src = re.sub(r'// <valley4:auto>\n.*?// </valley4:auto>', '', src, flags=re.S)
    names = set(re.findall(r"^\s*'([\w.]+)':", src, re.M))
    names |= set(re.findall(r"SPRITES\['([\w.]+)'\]\s*=", src))
    return names


def build():
    for fn in SECTIONS:
        fn()


def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument('--contact', help='dossier où écrire des planches de contrôle ×6 et les aperçus')
    args = ap.parse_args()
    build()
    items, pos, rows = pack()
    sheet = img(SHEET_COLS * T, rows * T)
    for name, im in items:
        c, r, w, h = pos[name]
        sheet.alpha_composite(im, (c * T, r * T))
    atlas = ROOT / 'src' / 'render' / 'atlas.js'
    src = atlas.read_text()
    mine = [n for n, _ in ENTRIES]
    assert len(mine) == len(set(mine))
    clash = sorted(set(mine) & existing_names(src))
    if clash:
        raise SystemExit('noms déjà pris dans atlas.js : ' + ', '.join(clash))
    sheet.save(HERE / 'valley4.png', optimize=True)
    lines = [HEADER, '// Généré par assets/sprites/generate-valley4.py — ne pas modifier à la main.', 'const valley4 = {']
    for name, _ in ENTRIES:
        c, r, _w, _h = pos[name]
        rw, rh = REAL[name]
        lines.append(f"  '{name}': {js_entry(SHEET, c, r, rw / T, rh / T)},")
    lines.append('};')
    lines.append('Object.assign(SPRITES, valley4);')
    block = '\n'.join(lines)
    decl = "  valley4: 'assets/sprites/valley4.png',\n"
    if decl not in src:
        anchor = "  valley3bg: 'assets/sprites/valley3-bg.png',\n"
        if anchor not in src:
            raise SystemExit('planche valley3bg absente de SHEETS dans src/render/atlas.js')
        src = src.replace(anchor, anchor + decl, 1)
    if '// <valley4:auto>' not in src:
        if '// </valley3:auto>\n' not in src:
            raise SystemExit('marqueur // </valley3:auto> absent de src/render/atlas.js')
        src = src.replace('// </valley3:auto>\n', '// </valley3:auto>\n\n// <valley4:auto>\n// </valley4:auto>\n', 1)
    new = re.sub(r'(// <valley4:auto>\n).*?(// </valley4:auto>)', lambda m: m.group(1) + block + '\n' + m.group(2),
                 src, flags=re.S)
    atlas.write_text(new)
    print(f'écrit {HERE / "valley4.png"} ({SHEET_COLS} × {rows} tuiles) : {len(mine)} sprites')
    if args.contact:
        contact_sheets(Path(args.contact))


# ---------------------------------------------------------------------------
# Contrôle visuel

def group_of(name):
    if name.startswith(('story.', 'valley.stage', 'postcard.', 'book.')):
        return 'vignettes'
    if name.startswith(('visitor.', 'stork.', 'fx.', 'view.beaverDam')):
        return 'visitors'
    if name.startswith(('legend.', 'forest.')):
        return 'legends-forest'
    return 'icons'


def contact_sheets(folder, scale=6):
    folder.mkdir(parents=True, exist_ok=True)
    groups = {}
    for name, _ in ENTRIES:
        groups.setdefault(group_of(name), []).append(get(name))
    for key, ims in groups.items():
        sc_ = 4 if key == 'vignettes' else scale
        W = 2000
        x = y = rowh = 0
        placed = []
        for im in ims:
            w, h = im.width * sc_ + 8, im.height * sc_ + 8
            if x + w > W:
                x, y, rowh = 0, y + rowh, 0
            placed.append((x, y, im))
            x += w
            rowh = max(rowh, h)
        out = Image.new('RGBA', (W, y + rowh), (132, 198, 105, 255))
        for (x, y, im) in placed:
            out.alpha_composite(im.resize((im.width * sc_, im.height * sc_), Image.NEAREST), (x + 4, y + 4))
        out.save(folder / f'valley4-art-contact-{key}.png')
    forest_preview(folder)
    nests_preview(folder)
    cloches_preview(folder)


def forest_preview(folder, scale=4):
    """La forêt de la carte (12 × 6 tuiles) dans ses 4 états : 0, 1/5, 2/5 (+ clairières), 3/5 + vieux arbres."""
    V3 = Image.open(HERE / 'valley3.png').convert('RGBA')
    top = TOWN.crop((7 * 16, 0, 8 * 16, 16))
    bottom = TOWN.crop((7 * 16, 32, 8 * 16, 48))
    clear = [V3.crop((c * 16, 77 * 16, (c + 1) * 16, 78 * 16)) for c in (1, 2, 3)]
    mixed = [get(n) for n in ('forest.mixed.oak', 'forest.mixed.beech', 'forest.mixed.birch', 'forest.mixed.cherry.bloom')]
    old = [get('forest.old.0'), get('forest.old.1'), get('forest.fern')]
    Wt, Ht = 12, 6
    states = []
    for n in range(4):
        im = Image.new('RGBA', (Wt * 16, Ht * 16), (132, 198, 105, 255))
        rnd = random.Random(5)
        for ty in range(Ht):
            for tx in range(Wt):
                part = top if ty == 0 else bottom if ty == Ht - 1 else FILL
                tile = part
                h = (tx * 7 + ty * 13) % 5
                if part is FILL:
                    dec = {0: 0, 1: 1, 2: 2, 3: 3}[n]
                    if h < dec:
                        tile = mixed[(tx + ty) % len(mixed)]
                    elif n >= 2 and (tx * 3 + ty) % 11 == 0:
                        tile = clear[(tx + ty) % 3]
                    elif n == 3 and (tx + ty * 5) % 7 == 0:
                        tile = old[(tx + ty) % 3]
                im.alpha_composite(tile, (tx * 16, ty * 16))
        states.append(im.resize((im.width * scale, im.height * scale), Image.NEAREST))
    out = Image.new('RGBA', (states[0].width * 2 + 12, states[0].height * 2 + 12), (30, 30, 30, 255))
    for i, s in enumerate(states):
        out.alpha_composite(s, ((i % 2) * (s.width + 12), (i // 2) * (s.height + 12)))
    out.save(folder / 'valley4-art-forest.png')


CHIMNEY = {1: (24, 3), 2: (40, 3), 3: (24, 3), 4: (24, 3), 5: (72, 18)}   # haut de la cheminée (px du sprite)


def nests_preview(folder, scale=4):
    tiles = []
    for lv in range(1, 6):
        house = house_crop(lv)
        for kind in ('wheel', 'pair', 'chicks', 'snow'):
            im = Image.new('RGBA', (house.width + 8, house.height + 24), (132, 198, 105, 255))
            im.alpha_composite(house, (4, 22))
            sp = get('stork.wheel') if kind == 'wheel' else get(f'stork.nest.{kind}')
            cx, cy = CHIMNEY[lv]
            im.alpha_composite(sp, (4 + cx - 12, 22 + cy + 2 - sp.height))
            tiles.append(im.resize((im.width * scale, im.height * scale), Image.NEAREST))
    rows = [tiles[i:i + 4] for i in range(0, len(tiles), 4)]
    W = max(sum(t.width + 8 for t in r) for r in rows)
    H = sum(max(t.height for t in r) + 8 for r in rows)
    out = Image.new('RGBA', (W, H), (30, 30, 30, 255))
    y = 0
    for r in rows:
        x = 0
        for t in r:
            out.alpha_composite(t, (x, y))
            x += t.width + 8
        y += max(t.height for t in r) + 8
    out.save(folder / 'valley4-art-nests.png')


def cloches_preview(folder, scale=5):
    V2 = Image.open(HERE / 'valley2.png').convert('RGBA')
    tiles = []
    for lv in range(1, 6):
        lib = V2.crop(((2 * lv) * 16, 32, (2 * lv + 2) * 16, 64))
        im = Image.new('RGBA', (48, 48), (132, 198, 105, 255))
        for x in range(0, 48, 16):
            pass
        im.alpha_composite(lib, (8, 0))
        names = ['legend.motherMelon.2', 'legend.millEinkorn.1', 'legend.farmMarvel.0', 'legend.cloche'] if lv < 5 else \
            ['legend.motherMelon.2', 'legend.millEinkorn.2', 'legend.farmMarvel.2', 'legend.storkPea.2']
        for i, n in enumerate(names):
            im.alpha_composite(get(n), (6 + i * 9, 34))
        tiles.append(im.resize((48 * scale, 48 * scale), Image.NEAREST))
    snow = tiles[0].copy()
    out = Image.new('RGBA', (len(tiles) * (48 * scale + 8), 48 * scale * 2 + 8), (30, 30, 30, 255))
    for i, t in enumerate(tiles):
        out.alpha_composite(t, (i * (t.width + 8), 0))
    # sur la neige aussi
    for i, n in enumerate(['legend.motherMelon.0', 'legend.millEinkorn.1', 'legend.farmMarvel.2', 'legend.storkPea.2',
                           'legend.cloche']):
        im = Image.new('RGBA', (16, 16), (240, 244, 250, 255))
        im.alpha_composite(get(n), (4, 2))
        out.alpha_composite(im.resize((16 * 12, 16 * 12), Image.NEAREST), (i * 200, 48 * scale + 8))
    out.save(folder / 'valley4-art-cloches.png')


if __name__ == '__main__':
    main()
