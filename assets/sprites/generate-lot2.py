#!/usr/bin/env python3
"""Génère assets/sprites/lot2.png : sprites du « lot 2 » (toucher et surprises) dans le style Kenney (CC0).

Contenu (voir docs/analyse/0-SYNTHESE.md, lot 2 = B1 à B6) :
  - légumes géants 32 × 32 (2 × 2 parcelles) pour chaque culture : crop.<id>.giant ;
  - qualité : pastilles quality.fine (étincelle d'argent) et quality.gold (étoile d'or), icônes dorées
    crop.<id>.icon.gold, étincelles animées fx.sparkle.0..3 ;
  - surprises de l'aube : fée (fairy.0..2), renard, hérisson, papillon rare, coffre ancien (fermé /
    ouvert), rond de champignons, chouette sculptée ;
  - météos spéciales : icônes 16 × 16 icon.weather.* (même style que assets/sprites/ui/icons.png),
    étoile filante star.shooting.0..1, voile de brouillard fog (32 × 32, raccordable, semi-transparent) ;
  - trouvailles au défrichage : find.well (16 × 32), find.statue, find.coins, find.seedjar,
    find.lostlamb, find.chest (= chest.old), land.stump.find ;
  - effets : fx.coin.0..3 (pièce qui tourne), fx.burst (éclat), fx.note (note de musique).

Même méthode que generate-v3.py / generate-career.py (dont on réutilise la palette et les outils) :
dessins ASCII ou construits par programme (une lettre = une couleur de la palette Kenney), contour
sombre (63, 38, 49) de 2 px ajouté autour de la silhouette, lumière venant d'en haut à gauche.

Le script :
  1. dessine chaque sprite ;
  2. les range dans la planche (placement automatique, déterministe, 16 tuiles de large) ;
  3. écrit assets/sprites/lot2.png ;
  4. réécrit, dans src/render/atlas.js, le bloc compris entre « // <lot2:auto> » et « // </lot2:auto> ».

Relancer :  python3 assets/sprites/generate-lot2.py   (nécessite Pillow)
Planches de contrôle (×6, avec des originaux Kenney) : python3 assets/sprites/generate-lot2.py --contact DOSSIER
"""
import sys
sys.dont_write_bytecode = True  # pas de __pycache__ dans assets/sprites

from pathlib import Path
import importlib.util
import math
import re
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


g3 = _load('gen_v3', HERE / 'generate-v3.py')
gi = _load('gen_icons', HERE / 'ui' / 'generate-icons.py')

T = 16
SHEET_COLS = 16
OUT = g3.OUT
FARM, TOWN = g3.FARM, g3.TOWN
V3 = Image.open(HERE / 'v3.png').convert('RGBA')
CAREER = Image.open(HERE / 'career.png').convert('RGBA')
img, tile, recolor, flip, lum = g3.img, g3.tile, g3.recolor, g3.flip, g3.lum

# Palette : celle de generate-v3.py + les teintes ajoutées par generate-career.py, et quelques voisines.
PAL = dict(g3.PAL)
PAL.update({
    'K': (255, 190, 170),   # rose clair
    'L': (236, 140, 138),   # rose
    'O': (190, 90, 100),    # rose foncé
    'X': (61, 33, 45),      # presque contour
    'H': (119, 56, 51),     # brun très sombre (Tiny Farm)
    'I': (184, 101, 66),    # brun (Tiny Town)
    'T': (255, 240, 200),   # crème lumineuse (reflets dorés)
    'U': (126, 96, 70),     # bois grisé (vieux bois)
    'V': (160, 130, 98),    # bois grisé clair
    'm': (111, 140, 84),    # mousse
    'a': (150, 120, 150),   # violet grisé (champignons, ombres de nuit)
})


def art(rows, outline=2, w=None, h=None, pal=None):
    return g3.art(rows, outline=outline, pal=pal or PAL, w=w, h=h)


def art4(rows, w=None, h=None, pal=None):
    """Comme art(), mais contour de 1 px en 4-voisins seulement (tout petits personnages : la fée)."""
    im = g3.art(rows, outline=0, pal=pal or PAL, w=w, h=h)
    px = im.load()
    filled = {(x, y) for y in range(im.height) for x in range(im.width) if px[x, y][3]}
    for (x, y) in filled:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            q = (x + dx, y + dy)
            if q not in filled and 0 <= q[0] < im.width and 0 <= q[1] < im.height:
                px[q] = OUT + (255,)
    return im


def paint(im, rows, x0=0, y0=0):
    """Peint un petit dessin ASCII par-dessus (sans contour ; « . » = inchangé, « _ » = transparent)."""
    px = im.load()
    for y, line in enumerate(rows):
        for x, ch in enumerate(line):
            if ch in '. ':
                continue
            px[x0 + x, y0 + y] = (0, 0, 0, 0) if ch == '_' else PAL[ch] + (255,)
    return im


def over(base, top, x=0, y=0):
    out = base.copy()
    out.alpha_composite(top, (x, y))
    return out


def sheet_tile(sheet, c, r, w=1, h=1):
    return sheet.crop((c * T, r * T, (c + w) * T, (r + h) * T))


def atlas_sprites(sheet_name, sheet):
    """Tuiles d'une planche générée (v3, career) par nom, lues dans atlas.js."""
    src = (ROOT / 'src' / 'render' / 'atlas.js').read_text()
    out = {}
    pat = r"'([\w.]+)': \{ sheet: '" + sheet_name + r"', col: (\d+), row: (\d+)(?:, w: (\d+), h: (\d+))? \}"
    for m in re.finditer(pat, src):
        c, r, w, h = int(m.group(2)), int(m.group(3)), int(m.group(4) or 1), int(m.group(5) or 1)
        out.setdefault(m.group(1), sheet_tile(sheet, c, r, w, h))
    return out


V3S = atlas_sprites('v3', V3)
CAS = atlas_sprites('career', CAREER)


class Grid(g3.Grid):
    """Canevas de lettres, avec formes ombrées et tampons « liserés » (comme compose())."""

    def cells_ellipse(self, cx, cy, rx, ry):
        out = []
        for y in range(int(cy - ry - 1), int(cy + ry + 2)):
            for x in range(int(cx - rx - 1), int(cx + rx + 2)):
                if ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1:
                    out.append((x, y))
        return out

    def layer(self, cells, ring='A'):
        """Pose un ensemble {(x, y): lettre} : liseré `ring` (8-voisins) sur ce qui est déjà dessiné
        autour, puis le remplissage. ring=None : pas de liseré."""
        if ring:
            for (x, y) in cells:
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        q = (x + dx, y + dy)
                        if q in cells:
                            continue
                        if self.get(*q) not in '.':
                            self.set(q[0], q[1], ring)
        for (x, y), ch in cells.items():
            self.set(x, y, ch)

    def ball(self, cx, cy, rx, ry, ramp, ring='A', light=(-0.55, -0.7, 0.5), cuts=None, bias=0.0, clip=None):
        """Ellipse ombrée comme une sphère : ramp = lettres du clair au sombre."""
        cells = {}
        for (x, y) in self.cells_ellipse(cx, cy, rx, ry):
            if clip and not clip(x, y):
                continue
            cells[(x, y)] = ramp[shade_index(((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry), ramp, light, cuts, bias)]
        self.layer(cells, ring)
        return cells

    def stamp_ring(self, rows, x0, y0, ring='A'):
        cells = {(x0 + x, y0 + y): ch for y, line in enumerate(rows) for x, ch in enumerate(line) if ch not in '. '}
        self.layer(cells, ring)

    def line(self, x0, y0, x1, y1, ch):
        n = max(abs(x1 - x0), abs(y1 - y0), 1)
        for i in range(n + 1):
            self.set(round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n), ch)


def shade_index(n, ramp, light=(-0.55, -0.7, 0.5), cuts=None, bias=0.0):
    nx, ny = n
    d = nx * nx + ny * ny
    nz = math.sqrt(max(0.0, 1 - d))
    lx, ly, lz = light
    ln = math.sqrt(lx * lx + ly * ly + lz * lz)
    v = (nx * lx + ny * ly + nz * lz) / ln + bias
    k = len(ramp)
    cuts = cuts or {1: [], 2: [0.15], 3: [0.72, 0.12], 4: [0.86, 0.5, 0.0], 5: [0.9, 0.66, 0.3, -0.15]}[k]
    for i, c in enumerate(cuts):
        if v >= c:
            return i
    return k - 1


# ---------------------------------------------------------------------------
# Registre : nom → image

ENTRIES = []   # (nom, image) dans l'ordre de placement
ALIASES = []   # (nom, nom_cible)
_seen = set()


def add(name, im):
    assert name not in _seen, name
    assert im.width % T == 0 and im.height % T == 0, (name, im.size)
    _seen.add(name)
    ENTRIES.append((name, im))
    return im


def alias(name, target):
    assert name not in _seen, name
    _seen.add(name)
    ALIASES.append((name, target))


def get(name):
    for n, im in ENTRIES:
        if n == name:
            return im
    raise KeyError(name)


# ===========================================================================
# 1. Légumes géants (32 × 32, posés sur un carré de 2 × 2 parcelles ; bas du sprite = bas du carré)

BIG_LEAF = [  # grande feuille de courge (vue de face, lobée), nervure centrale
    '...gG..gG...',
    '..gGGGgGGd..',
    '.gGGdGGGdGd.',
    'gGGGGdGdGGdd',
    'gGdGGGdGGdGd',
    '.GGGdGdGdGd.',
    '..GdGGdGGd..',
    '...ddd.dd...',
]
LEAF_M = ['.gGG.', 'gGGGd', 'GGdGd', 'GdGdd', '.ddd.']
LEAF_S = ['.gG.', 'gGGd', 'GGdd', '.dd.']


def leaf_cells(x0, y0, x1, y1, width, ramp='gGd', vein='d'):
    """Feuille en amande du point (x0, y0) (pétiole) au point (x1, y1) (pointe), ombrée, nervure."""
    cells = {}
    L = math.hypot(x1 - x0, y1 - y0)
    ux, uy = (x1 - x0) / L, (y1 - y0) / L
    px_, py_ = -uy, ux
    for y in range(int(min(y0, y1) - width - 2), int(max(y0, y1) + width + 3)):
        for x in range(int(min(x0, x1) - width - 2), int(max(x0, x1) + width + 3)):
            fx, fy = x + 0.5 - x0, y + 0.5 - y0
            t = (fx * ux + fy * uy) / L
            s = fx * px_ + fy * py_
            if not 0 <= t <= 1:
                continue
            half = width * math.sin(math.pi * min(1, t * 1.08)) ** 0.8
            if abs(s) > half:
                continue
            if abs(s) < 0.6 and 0.08 < t < 0.85:
                cells[(x, y)] = vein
                continue
            # côté éclairé : celui qui regarde vers le haut à gauche
            lit = (px_ * -0.6 + py_ * -0.8) * (1 if s > 0 else -1)
            edge = abs(s) / max(half, 0.01)
            if lit > 0.1 and edge > 0.35:
                cells[(x, y)] = ramp[0]
            elif lit < -0.1 and edge > 0.45:
                cells[(x, y)] = ramp[2]
            else:
                cells[(x, y)] = ramp[1]
    return cells


def giant_pumpkin():
    g = Grid(32, 32)
    # feuilles et vrille derrière
    g.layer(leaf_cells(12, 15, 2, 9, 4.2))
    g.layer(leaf_cells(20, 15, 30, 10, 4.2))
    g.layer(leaf_cells(9, 26, 2, 22, 3.2))
    for (x, y) in ((25, 6), (26, 5), (27, 5), (28, 6), (28, 7), (27, 8)):
        g.set(x, y, 'd')
    # côtes : des plus éloignées (sombres) à celle du milieu (claire), sillons orange foncé
    cy, ry = 21.0, 8.6
    lobes = [(5.6, 4.6, -0.35), (26.4, 4.6, -0.25), (10.4, 5.6, -0.12), (21.6, 5.6, -0.05), (16.0, 5.4, 0.08)]
    for i, (cx, rx, bias) in enumerate(lobes):
        r = ry - (0.9 if i < 2 else 0.35 if i < 4 else 0)
        g.ball(cx, cy + (0.4 if i < 2 else 0), rx, r, 'iyYo', ring='o' if i else 'A', bias=bias,
               light=(-0.45, -0.75, 0.55))
    # bas des côtes plus sombre (ombre portée au sol)
    for x in range(32):
        for y in range(27, 31):
            if g.get(x, y) == 'Y' and y >= 28:
                g.set(x, y, 'o')
    # creux du pédoncule et pédoncule
    for x in range(13, 20):
        if g.get(x, 13) in 'iyY':
            g.set(x, 13, 'o')
    g.stamp_ring(['..dN.', '.dNN.', '.dNn.', 'dNNn.', 'dNn..'], 13, 9)
    g.stamp(['.N', 'N.'], 17, 8)
    # petits reflets
    for (x, y) in ((14, 16), (15, 15), (8, 17)):
        g.set(x, y, 'T' if (x, y) == (15, 15) else 'i')
    return art(g.rows(), w=32, h=32)


def giant_tomato():
    g = Grid(32, 32)
    g.layer(leaf_cells(10, 12, 2, 6, 3.6))
    g.layer(leaf_cells(22, 12, 30, 6, 3.6))
    # fruit : deux lobes légers puis le fruit
    g.ball(16, 19.5, 13.2, 10.8, 'eRRq', ring='A', light=(-0.5, -0.65, 0.6), cuts=[0.9, 0.55, -0.05])
    for (x, y) in ((9, 13), (10, 12), (9, 14), (21, 11), (22, 12)):
        pass
    # côtes discrètes
    for y in range(14, 27):
        for x in (11, 21):
            if g.get(x, y) == 'R' and 15 < y < 26:
                g.set(x, y, 'q') if y > 20 else None
    # reflet
    g.stamp(['.ww', 'wee', 'we.'], 7, 13)
    g.set(9, 17, 'e')
    # calice en étoile
    star = ['....d.....d....', '..d.dG...Gd.d..', '.dGGdGGdGGdGGd.', '..ddGGGdGGGdd..', '.dG..ddNdd..Gd.',
            '.d.....N.....d.']
    g.stamp_ring(star, 9, 7)
    g.stamp_ring(['.dN', 'dNn', 'Nn.'], 15, 4)
    return art(g.rows(), w=32, h=32)


def giant_cabbage():
    g = Grid(32, 32)
    # feuilles extérieures (ouvertes, sombres)
    g.ball(7.5, 21, 6.5, 7, 'GdD', light=(-0.5, -0.6, 0.6))
    g.ball(24.5, 21, 6.5, 7, 'GdD', light=(-0.5, -0.6, 0.6))
    g.ball(16, 25.5, 11, 4.6, 'GdD', light=(-0.5, -0.6, 0.6))
    for (x0, y0, x1, y1) in ((7, 26, 4, 17), (24, 26, 28, 17), (12, 29, 9, 25), (20, 29, 23, 25)):
        g.line(x0, y0, x1, y1, 'g')
    # pomme du chou
    g.ball(16, 16.5, 10, 9.2, 'jgGd', light=(-0.5, -0.7, 0.5), cuts=[0.88, 0.45, -0.25])
    # feuilles enroulées (arcs)
    for (cx, cy, r, a0, a1, ch) in ((16, 22, 9, 200, 340, 'd'), (11, 19, 6, 200, 300, 'G'),
                                    (21, 19, 6, 240, 340, 'G'), (16, 15, 5, 190, 350, 'G')):
        for a in range(a0, a1, 4):
            x = round(cx + r * math.cos(math.radians(a)))
            y = round(cy + r * math.sin(math.radians(a)) * 0.9)
            if g.get(x, y) not in '.A':
                g.set(x, y, ch)
    # nervures
    g.line(16, 10, 16, 24, 'g')
    g.line(16, 18, 12, 13, 'g')
    g.line(16, 18, 20, 13, 'g')
    for (x, y) in ((12, 10), (13, 9), (14, 9)):
        g.set(x, y, 'w') if False else g.set(x, y, 'j')
    return art(g.rows(), w=32, h=32)


def giant_turnip():
    g = Grid(32, 32)
    # fanes
    g.layer(leaf_cells(15, 13, 6, 2, 3.6))
    g.layer(leaf_cells(17, 13, 26, 2, 3.6))
    g.layer(leaf_cells(16, 13, 16, 1, 3.2))
    # racine-queue
    g.stamp_ring(['lk', 'lk', '.k', '.k'], 15, 27)
    # bulbe : violet en haut, crème en bas (limite ondulée)
    cells = {}
    cx, cy, rx, ry = 16, 20, 11.5, 8.6
    for (x, y) in g.cells_ellipse(cx, cy, rx, ry):
        n = ((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry)
        wave = 1.2 * math.sin(x * 0.9)
        if y < cy + 1.5 + wave:
            ramp = 'KPQ'
            ramp = 'PPQ'
            cells[(x, y)] = 'PPQ'[shade_index(n, 'PPQ', cuts=[0.7, 0.05])]
            if shade_index(n, 'xxxx') == 0:
                cells[(x, y)] = 'K'
        else:
            cells[(x, y)] = 'wlk'[shade_index(n, 'wlk', cuts=[0.75, -0.2])]
    g.layer(cells)
    # stries
    for (x, y) in ((10, 23), (11, 24), (21, 24), (22, 23), (14, 26), (18, 26)):
        g.set(x, y, 'k')
    g.stamp(['ww', 'w.'], 9, 15)
    # collet vert
    g.stamp_ring(['.GdG.', 'GGdGG'], 14, 11)
    return art(g.rows(), w=32, h=32)


def capsule_cells(ax0, ay0, ax1, ay1, r0, r1, size=32):
    """Cellules d'un fuseau du point 0 (rayon r0) au point 1 (rayon r1), bouts arrondis.
    Renvoie {(x, y): (t, s)} : t = position le long de l'axe (0..1), s = écart normalisé (-1 = côté haut)."""
    out = {}
    L = math.hypot(ax1 - ax0, ay1 - ay0)
    ux, uy = (ax1 - ax0) / L, (ay1 - ay0) / L
    if uy * 1 - ux * 0 > 0:
        pass
    for y in range(size):
        for x in range(size):
            fx, fy = x + 0.5 - ax0, y + 0.5 - ay0
            t = fx * ux + fy * uy
            s_ = -fx * uy + fy * ux
            tt = max(0.0, min(L, t))
            r = r0 + (r1 - r0) * tt / L
            if math.hypot(t - tt, s_) <= r:
                sn = s_ / max(r, 0.5)
                # « haut » = du côté où la normale pointe vers le haut de l'écran
                up = -uy * 0 + ux  # composante y de la normale (-uy, ux) : ux
                out[(x, y)] = (tt / L, sn if ux >= 0 else -sn)
    return out


def giant_carrot():
    g = Grid(32, 32)
    # racine couchée en biais : collet en haut à droite, pointe en bas à gauche
    A0, A1 = (21.0, 13.0), (4.0, 29.0)
    R0, R1 = 7.4, 0.8
    cells = {}
    for (x, y), (t, sn) in capsule_cells(A0[0], A0[1], A1[0], A1[1], R0, R1).items():
        cells[(x, y)] = 'iyYo'[shade_index((sn * 0.85, 0.15 - 0.3 * t), 'iyYo', light=(0, -1, 0.55),
                                           cuts=[0.93, 0.5, -0.05])]
    g.layer(cells)
    # sillons perpendiculaires à l'axe
    L = math.hypot(A1[0] - A0[0], A1[1] - A0[1])
    ux, uy = (A1[0] - A0[0]) / L, (A1[1] - A0[1]) / L
    for (t, a, b) in ((0.2, -0.95, -0.25), (0.34, 0.25, 0.95), (0.48, -0.9, -0.2), (0.61, 0.2, 0.9), (0.74, -0.8, 0.0)):
        cx, cy = A0[0] + ux * L * t, A0[1] + uy * L * t
        r = R0 + (R1 - R0) * t
        for k in range(8):
            sv = a + (b - a) * k / 7
            x, y = math.floor(cx - uy * r * sv), math.floor(cy + ux * r * sv)
            if g.get(x, y) in 'iyY':
                g.set(x, y, 'o' if g.get(x, y) == 'Y' else 'Y')
    # fanes plumeuses, qui partent du collet
    for (x1, y1, w) in ((13, 3, 2.5), (20, 1, 2.6), (28, 2, 2.6), (30, 10, 2.3)):
        g.layer(leaf_cells(23, 10, x1, y1, w))
    g.stamp_ring(['.dGd', 'dGGd', 'GGd.'], 21, 8)
    g.stamp(['T', 'i'], 13, 15)
    g.set(14, 14, 'i')
    return art(g.rows(), w=32, h=32)


def giant_corn():
    g = Grid(32, 32)
    # feuilles de la tige, derrière
    g.layer(leaf_cells(15, 26, 2, 14, 3.0))
    g.layer(leaf_cells(17, 26, 30, 13, 3.0))
    # épi : grains en damier ombré
    cells = {}
    cx, cy, rx, ry = 16, 13.5, 6.6, 11.2
    for (x, y) in g.cells_ellipse(cx, cy, rx, ry):
        n = ((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry)
        k = shade_index(n, 'iyY', light=(-0.7, -0.4, 0.55), cuts=[0.75, 0.1])
        groove = (y % 3 == 2) or ((x + (y // 3) % 2) % 3 == 0)
        cells[(x, y)] = ('yYo' if groove else 'iyY')[k]
    g.layer(cells)
    # spathes (feuilles qui enveloppent l'épi)
    g.layer(leaf_cells(14, 30, 7, 9, 3.4, ramp='jGd'))
    g.layer(leaf_cells(18, 30, 25, 9, 3.4, ramp='jGd'))
    g.layer(leaf_cells(16, 30, 13, 18, 2.4, ramp='jGd'))
    # soies
    g.stamp_ring(['.b.b.', 'bBnBb', '.nBn.'], 14, 1)
    g.stamp(['ww', 'w.'], 13, 6)
    return art(g.rows(), w=32, h=32)


def giant_wheat():
    g = Grid(32, 32)
    # tiges (s'évasent en bas), lien au milieu
    cells = {}
    for i, x0 in enumerate(range(9, 24, 2)):
        xb = 16 + (x0 - 16) * 1.5
        xt = 16 + (x0 - 16) * 1.25
        for y in range(15, 30):
            t = (y - 15) / 15
            xm = 16 + (x0 - 16) * 0.55
            x = xt + (xm - xt) * min(1, t / 0.45) if t < 0.45 else xm + (xb - xm) * (t - 0.45) / 0.55
            xi = round(x)
            cells[(xi, y)] = 'Y' if i % 3 == 2 else 'y'
            cells[(xi + 1, y)] = 'Y'
    g.layer(cells, ring=None)
    # épis en éventail
    for ang in (-62, -40, -20, 0, 20, 40, 62):
        a = math.radians(ang - 90)
        ex, ey = 16 + 11 * math.cos(a), 15 + 11 * math.sin(a)
        bx, by = 16 + 4 * math.cos(a), 15 + 4 * math.sin(a)
        c = {}
        L = math.hypot(ex - bx, ey - by)
        ux, uy = (ex - bx) / L, (ey - by) / L
        for y in range(0, 20):
            for x in range(0, 32):
                fx, fy = x + 0.5 - bx, y + 0.5 - by
                t = (fx * ux + fy * uy) / L
                s = -fx * uy + fy * ux
                if 0 <= t <= 1 and abs(s) <= 2.1 * math.sin(math.pi * min(1, 0.15 + t * 0.9)) ** 0.6:
                    kern = (round(t * 9) % 2 == 0)
                    c[(x, y)] = ('i' if s < -0.5 else 'y') if kern else ('y' if s < 0 else 'Y')
        g.layer(c)
        # barbes
        for k in range(2, 4):
            g.set(round(ex + ux * k), round(ey + uy * k), 'y')
    # lien de paille tressée
    g.stamp_ring(['nBnBnBnBnBn', 'BnBnBnBnBnB'], 11, 20)
    g.stamp(['ww', 'w.'], 13, 5)
    return art(g.rows(), w=32, h=32)


def giant_sunflower():
    g = Grid(32, 32)
    # tige épaisse et deux grandes feuilles
    g.rect(15, 18, 17, 30, 'G')
    g.rect(17, 18, 17, 30, 'd')
    g.rect(15, 18, 15, 30, 'g')
    g.layer(leaf_cells(15, 25, 3, 18, 4.0))
    g.layer(leaf_cells(17, 23, 29, 16, 4.0))
    # pétales
    cells = {}
    cx, cy = 16, 11.5
    for y in range(0, 24):
        for x in range(32):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            r = math.hypot(dx, dy)
            th = math.atan2(dy, dx)
            edge = 9.0 + 2.6 * abs(math.cos(7 * th))
            if r <= edge:
                petal = abs(math.cos(7 * th))
                cells[(x, y)] = 'i' if (petal > 0.75 and dx + dy < 2) else ('y' if petal > 0.35 else 'Y')
    g.layer(cells)
    # cœur : graines en spirale (damier sombre)
    heart = {}
    for (x, y) in g.cells_ellipse(cx, cy, 6.2, 6.2):
        n = ((x + 0.5 - cx) / 6.2, (y + 0.5 - cy) / 6.2)
        k = shade_index(n, 'bnN', light=(-0.5, -0.7, 0.5), cuts=[0.8, 0.15])
        seed = (x + y) % 2 == 0
        heart[(x, y)] = ('bnN' if seed else 'nNH')[k]
    g.layer(heart, ring='Y')
    return art(g.rows(), w=32, h=32)


def giant_potato():
    g = Grid(32, 32)
    # fanes et fleurs blanches
    g.layer(leaf_cells(14, 16, 4, 7, 3.6))
    g.layer(leaf_cells(18, 15, 28, 6, 3.6))
    g.layer(leaf_cells(16, 15, 15, 3, 3.2))
    for (x, y) in ((6, 5), (26, 4), (15, 1)):
        g.stamp_ring(['.w.', 'wyw', '.w.'], x - 1, y - 1)
    # tubercule : bosses
    cells = {}
    blobs = [(10, 22.5, 7.5, 6.2), (20.5, 21.5, 9.5, 7.2), (14.5, 24.5, 8, 5.2)]
    for (x, y) in {c for b in blobs for c in g.cells_ellipse(*b)}:
        n = ((x + 0.5 - 16) / 13.5, (y + 0.5 - 22) / 8.2)
        cells[(x, y)] = 'kbBn'[shade_index(n, 'kbBn', cuts=[0.85, 0.4, -0.3])]
    g.layer(cells)
    for (x, y) in ((9, 21), (17, 19), (23, 23), (13, 26), (20, 26), (26, 19)):
        g.set(x, y, 'n')
        g.set(x + 1, y + 1, 'B') if g.get(x + 1, y + 1) == 'b' else None
    g.stamp(['ll', 'l.'], 7, 19)
    return art(g.rows(), w=32, h=32)


def giant_strawberry():
    g = Grid(32, 32)
    g.layer(leaf_cells(11, 10, 2, 5, 3.4))
    g.layer(leaf_cells(21, 10, 30, 5, 3.4))
    cells = {}
    for y in range(8, 31):
        for x in range(32):
            fx, fy = x + 0.5 - 16, y + 0.5
            # cœur arrondi : large en haut, pointe en bas
            t = (fy - 8) / 22
            half = 12.5 * math.sqrt(max(0, 1 - ((t - 0.28) / 0.72) ** 2)) if t > 0.28 else 12.5 * math.sqrt(max(0, 1 - ((0.28 - t) / 0.3) ** 2))
            if abs(fx) <= half:
                n = (fx / max(half, 1) * 0.9, (t - 0.45) * 1.6)
                cells[(x, y)] = 'pRRq'[shade_index(n, 'pRRq', cuts=[0.9, 0.5, -0.1])]
    g.layer(cells)
    # akènes
    for y in range(12, 29, 3):
        for x in range(4 + (y // 3) % 2 * 2, 30, 4):
            ch = g.get(x, y)
            if ch in 'pRq' and g.get(x, y + 1) in 'pRq':
                g.set(x, y, 'i')
                g.set(x, y + 1, 'q' if ch != 'q' else 'q')
    g.stamp(['ww', 'w.'], 7, 13)
    # collerette de sépales
    g.stamp_ring(['.d...d...d.', 'dGdGGdGGdGd', '.dGGgdgGGd.', '..d.dNd.d..'], 10, 6)
    g.stamp_ring(['dN', 'N.'], 16, 3)
    return art(g.rows(), w=32, h=32)


def giant_zucchini():
    g = Grid(32, 32)
    g.layer(leaf_cells(12, 14, 2, 4, 4.0))
    g.layer(leaf_cells(18, 13, 28, 3, 4.0))
    # courgette couchée en biais : capsule rayée
    cells = {}
    ax0, ay0, ax1, ay1, rad = 5.0, 24.0, 27.0, 17.0, 5.6
    L = math.hypot(ax1 - ax0, ay1 - ay0)
    ux, uy = (ax1 - ax0) / L, (ay1 - ay0) / L
    for y in range(32):
        for x in range(32):
            fx, fy = x + 0.5 - ax0, y + 0.5 - ay0
            t = fx * ux + fy * uy
            s = -fx * uy + fy * ux   # < 0 : côté haut
            tt = max(0, min(L, t))
            r = rad * (0.82 + 0.18 * tt / L)
            if math.hypot(t - tt, s) > r and not (0 <= t <= L and abs(s) <= r):
                continue
            if not (0 <= t <= L) and math.hypot(t - tt, s) > r:
                continue
            ns = s / r
            stripe = int((ns + 1) * 3.2) % 2 == 0
            if ns < -0.55:
                ch = 'g' if stripe else 'G'
            elif ns < 0.45:
                ch = 'G' if stripe else 'd'
            else:
                ch = 'd' if stripe else 'D'
            if (t < 1.5 or t > L - 1.5) and ch == 'g':
                ch = 'G'
            cells[(x, y)] = ch
    g.layer(cells)
    # mouchetures
    for (x, y) in ((9, 21), (13, 19), (17, 18), (21, 17), (12, 23), (19, 21)):
        if g.get(x, y) not in '.A':
            g.set(x, y, 'j')
    # pédoncule (côté droit) et fleur (côté gauche)
    g.stamp_ring(['.bB', 'bBn', 'Bn.'], 27, 12)
    g.stamp_ring(['.y.y.', 'yiyYy', '.YyY.', '..Y..'], 0, 21)
    return art(g.rows(), w=32, h=32)


GIANTS = {
    'carrot': giant_carrot, 'turnip': giant_turnip, 'wheat': giant_wheat, 'cabbage': giant_cabbage,
    'tomato': giant_tomato, 'corn': giant_corn, 'sunflower': giant_sunflower, 'pumpkin': giant_pumpkin,
    'potato': giant_potato, 'strawberry': giant_strawberry, 'zucchini': giant_zucchini,
}


def giant_section():
    for cid, fn in GIANTS.items():
        add(f'crop.{cid}.giant', fn())


# ===========================================================================
# 2. Qualité : pastilles, icônes dorées, étincelles

def crop_icons():
    icons = {
        'carrot': tile(8, 0), 'turnip': tile(8, 1), 'corn': tile(8, 2), 'tomato': tile(8, 3),
        'cabbage': tile(8, 4), 'wheat': tile(8, 5), 'sunflower': tile(11, 6),
    }
    for cid in ('pumpkin', 'potato', 'strawberry', 'zucchini'):
        icons[cid] = V3S[f'crop.{cid}.icon']
    return icons


GOLD_RAMP = ['o', 'Y', 'y', 'i']   # du plus sombre au plus clair


def is_green(p):
    r, g_, b = p[:3]
    return g_ > r + 12 and g_ > b


def golden(im):
    """Version dorée d'une icône : la récolte passe sur la rampe d'or (même ordre de clarté que
    l'original) ; les feuilles restent vertes, sauf pour les légumes tout verts (chou, courgette), qui
    deviennent entièrement dorés. Petit reflet blanc en haut à gauche."""
    im = im.copy()
    px = im.load()
    W, H = im.size
    fill = [(x, y) for y in range(H) for x in range(W) if px[x, y][3] and px[x, y][:3] != OUT]
    green_share = sum(1 for q in fill if is_green(px[q])) / max(1, len(fill))
    all_gold = green_share > 0.65
    produce = lambda p: all_gold or not is_green(p)
    cols = sorted({px[q][:3] for q in fill if produce(px[q])}, key=lum)
    n = len(cols)
    gmap = {}
    for i, c in enumerate(cols):
        k = round(i * (len(GOLD_RAMP) - 1) / (n - 1)) if n > 1 else 2
        if n == 2:
            k = (1, 2)[i]
        if n == 3:
            k = (0, 2, 3)[i] if all_gold else (1, 2, 3)[i]
        gmap[c] = PAL[GOLD_RAMP[k]]
    for (x, y) in fill:
        p = px[x, y]
        px[x, y] = (gmap[p[:3]] if produce(p) else p[:3]) + (p[3],)
    # reflet : premier pixel clair en haut à gauche (balayage diagonal)
    for sdiag in range(2 * W):
        hit = None
        for x in range(sdiag + 1):
            y = sdiag - x
            if x < W and y < H and px[x, y][3] and px[x, y][:3] in (PAL['i'], PAL['y']) and produce(px[x, y]):
                hit = (x, y)
                break
        if hit:
            px[hit] = PAL['w'] + (255,)
            if px[hit[0], hit[1] + 1][:3] in (PAL['y'], PAL['i']):
                px[hit[0], hit[1] + 1] = PAL['T'] + (255,)
            break
    return im


def mini_sparkle(im, x, y, big=False):
    """Étincelle à 4 branches (centre blanc) avec un liseré sombre de 1 px, centrée en (x, y)."""
    rows = ['..i..', '..y..', 'iywyi', '..y..', '..i..'] if big else ['.i.', 'iwi', '.i.']
    s = art(rows, outline=1, w=16, h=16)
    k = len(rows) // 2 + 1
    out = im.copy()
    out.alpha_composite(s.crop((0, 0, len(rows) + 2, len(rows) + 2)), (x - k, y - k))
    return out


# Étoile d'or (pastille de qualité « dorée ») : 9 × 9 avec le contour, en haut à droite de la tuile
STAR_GOLD = [
    '...T...',
    '..TyY..',
    'TTyyyYY',
    '.yyyyY.',
    '..yyY..',
    '.yY.YY.',
    '.Y...Y.',
]
# Étincelle d'argent (pastille « belle ») : losange à 4 branches, forme différente de l'étoile
SPARK_SILVER = [
    '...w...',
    '...W...',
    '..wWs..',
    'wWWWWsS',
    '..Wss..',
    '...s...',
    '...S...',
]


def badge(rows):
    s = art(rows, outline=1, w=16, h=16)
    out = img()
    out.alpha_composite(s.crop((0, 0, 9, 9)), (7, 0))
    return out


SPARKLE_FRAMES = [
    ['.....', '.....', '..y..', '.....', '.....'],
    ['.....', '..i..', '.iwi.', '..i..', '.....'],
    ['...i...', '...y...', '...y...', 'iyywyyi', '...y...', '...y...', '...i...'],
    ['y.....y', '.......', '...i...', '..iwi..', '...i...', '.......', 'y.....y'],
]


def sparkle_frame(rows):
    w = len(rows[0])
    s = art(rows, outline=1, w=16, h=16)
    out = img()
    o = (16 - (w + 2)) // 2
    out.alpha_composite(s.crop((0, 0, w + 2, len(rows) + 2)), (o, o))
    return out


def quality_section():
    add('quality.fine', badge(SPARK_SILVER))
    add('quality.gold', badge(STAR_GOLD))
    for cid, icon in crop_icons().items():
        add(f'crop.{cid}.icon.gold', mini_sparkle(golden(icon), 13, 3))
    for i, rows in enumerate(SPARKLE_FRAMES):
        add(f'fx.sparkle.{i}', sparkle_frame(rows))


# ===========================================================================
# 3. Surprises de l'aube

def glow(im, cx, cy, r, color=(255, 240, 170), alpha=110):
    """Halo doux (dégradé radial semi-transparent) sous l'image."""
    halo = img(im.width, im.height)
    hp = halo.load()
    for y in range(im.height):
        for x in range(im.width):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r
            if d < 1:
                a = int(alpha * (1 - d) ** 1.2)
                # paliers (style pixel) plutôt qu'un dégradé lisse
                a = (a // 28) * 28
                if a:
                    hp[x, y] = color + (a,)
    halo.alpha_composite(im)
    return halo


FAIRY_BODY = [
    '................',
    '................',
    '................',
    '.......yy.......',
    '......yyyy......',
    '......ykly......',
    '......ykkk......',
    '.......kk.......',
    '......PpPP......',
    '......PPPQ......',
    '.....PPPPQQ.....',
    '.....PPPQQQ.....',
]
FAIRY_WINGS = {  # (ligne, motif de l'aile droite à partir de la colonne 10) ; l'aile gauche est en miroir
    0: [(3, '.vv.'), (4, 'cvvv'), (5, 'ccvv'), (6, 'ccc.'), (7, 'c...')],   # ailes hautes
    1: [(5, 'cvvv'), (6, 'cccv'), (7, 'ccc.'), (8, 'c...')],                # ailes ouvertes
    2: [(7, 'cvv.'), (8, 'ccvv'), (9, 'ccc.'), (10, '.c..')],               # ailes basses
}


def fairy(frame):
    out = img()
    bob = (0, -1, 0)[frame]
    wings = img()
    wp = wings.load()
    for (y, line) in FAIRY_WINGS[frame]:
        for i, ch in enumerate(line):
            if ch == '.':
                continue
            for x in (5 - i, 10 + i):
                wp[x, y + bob] = PAL[ch] + (200,)
    filled = {(x, y) for y in range(16) for x in range(16) if wp[x, y][3]}
    for (x, y) in list(filled):
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            q = (x + dx, y + dy)
            if q not in filled and 0 <= q[0] < 16 and 0 <= q[1] < 16 and not (6 <= q[0] <= 9):
                wp[q] = PAL['C'] + (230,)
    body = art4(FAIRY_BODY, w=16, h=16)
    out.alpha_composite(wings)
    out.alpha_composite(shift_img(body, 0, bob))
    op = out.load()
    dust = [((7, 13), 'i'), ((9, 14), 'w'), ((6, 15), 'y')] if frame != 1 else [((8, 13), 'w'), ((10, 15), 'i'), ((6, 14), 'y')]
    for (x, y), ch in dust:
        op[x, y] = PAL[ch] + (255,)
    return glow(out, 8, 7.5 + bob, 8.5)


def shift_img(im, dx, dy):
    out = img(im.width, im.height)
    out.paste(im, (dx, dy), im)
    return out


FOX = [
    '................',
    '................',
    '................',
    '..........w..w..',
    '.........YY.YY..',
    '.........YYYYY..',
    '........YYYZYZ..',
    '.YY.....YYYYYwwA',
    'YYYY....wwYYwww.',
    'YYYYYYYYYYwwww..',
    'wYYYYYYYYYYww...',
    '.wwYYYYYYYYo....',
    '...ooYYYYYoo....',
    '...N.N...N.N....',
    '...H.H...H.H....',
]
FOX_WALK = FOX[:13] + [
    '....N.N.N..N....',
    '....H.H.H..H....',
]
FOX_SIT = [
    '................',
    '................',
    '........w..w....',
    '.......YY.YY....',
    '.......YYYYY....',
    '......YYZYZYw...',
    '......YYYYYwwwA.',
    '......YwwYwwww..',
    '.......wwwYww...',
    '......YwwwYY....',
    '.YY..YYwwwYYY...',
    'YYYY.YYwwYYYY...',
    'wYYYYYYYYYYYo...',
    '.wwYYYYYoNoN....',
    '..wwwooooHoH....',
]
FOX_SLEEP = [  # roulé en boule, yeux fermés, la queue au bout blanc ramenée devant
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '.........Y.Y....',
    '...YYYYYYYYYY...',
    '..YYYYYYYYYYYw..',
    '.YYYYYYYYYZZww..',
    '.YYYYYYYYYYYww..',
    '.YYYYYYYYYYoo...',
    '.wwwwwYYYYYoo...',
    '..wwwwwwwYoo....',
    '...ooooooooo....',
]


def fox_pal():
    pal = dict(PAL)
    pal['Y'] = (227, 122, 52)   # roux (voisin du Y Kenney, un peu plus rouge)
    pal['o'] = (170, 80, 45)
    pal['N'] = PAL['N']
    return pal


HEDGEHOG = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '.....n.n.n......',
    '...nnNnNnNn.....',
    '..nNnNnNnNnNk...',
    '.nNnNnNnNnNkkk..',
    '.NnNnNnNnNkkkkZ.',
    'nNnNnNnNnNkkZkkA',
    'NnNnNnNnNkkkkkk.',
    '.NNNNNNNbbbbkb..',
    '..bB..bB..bB....',
]
HEDGEHOG_WALK = HEDGEHOG[:13] + ['...bB.bB.bB.....']


BUTTERFLY = {
    0: [  # ailes ouvertes (vu de dessus)
        '................',
        '................',
        '................',
        '...uu.....uu....',
        '..uccu.N.ucccu..',
        '.ucvccuNucvccu..',
        '.ucccccNcccccu..',
        '.uucccuNucccuu..',
        '..uuuuuNuuuuu...',
        '...uPPuNuPPu....',
        '...uPuuNuuPu....',
        '....uu.N.uu.....',
    ],
    1: [  # ailes à demi refermées (battement)
        '................',
        '................',
        '................',
        '....uu.N.uu.....',
        '....ucuNucu.....',
        '....ucvNvcu.....',
        '....uccNccu.....',
        '....uucNcuu.....',
        '.....uPNPu......',
        '.....uuNuu......',
        '.......N........',
    ],
}


def butterfly(frame):
    pal = dict(PAL)
    pal['N'] = PAL['Z']
    im = art(BUTTERFLY[frame], outline=1, pal=pal)
    return glow(im, 8, 8, 7.5, color=(200, 240, 255), alpha=80)


CHEST_CLOSED = [
    '................',
    '................',
    '................',
    '....nnnnnnnn....',
    '...nbkbbbbkbn...',
    '..nbkbbbbbbkbn..',
    '..nsbbbbbbbbsn..',
    '..SsSSSyySSSsS..',
    '..bsbbbyYbbbsB..',
    '..bsbbbYYbbbsB..',
    '..bsbbbbbbbbsB..',
    '..BsBBBBBBBBsn..',
    '..nSnnnnnnnnSn..',
]
CHEST_OPEN = [
    '................',
    '...NNNNNNNNNN...',
    '..NHHHHHHHHHHN..',
    '..NsHHHHHHHHsN..',
    '..NsHHHHHHHHsN..',
    '..SSSSSSSSSSSS..',
    '...iTyiyyiTy....',
    '..yiyyTyiyyyiy..',
    '..bsbbbyYbbbsB..',
    '..bsbbbYYbbbsB..',
    '..bsbbbbbbbbsB..',
    '..BsBBBBBBBBsn..',
    '..nSnnnnnnnnSn..',
]


def old_chest(opened=False):
    im = art(CHEST_OPEN if opened else CHEST_CLOSED)
    if opened:
        im = mini_sparkle(im, 12, 5)
        im = mini_sparkle(im, 4, 6)
    return im


def mushroom_ring():
    """Rond de champignons (à poser sur une parcelle) : 7 petits champignons en cercle, herbe foncée."""
    out = img()
    op = out.load()
    # anneau d'herbe plus sombre (semi-transparent)
    for y in range(16):
        for x in range(16):
            d = math.hypot((x + 0.5 - 8) / 6.4, (y + 0.5 - 8.6) / 5.4)
            if 0.8 < d < 1.12:
                op[x, y] = PAL['d'] + (120,)
    small = art(['.EE.', 'EwEE', '.kk.'], outline=1, w=16, h=16).crop((0, 0, 6, 5))
    tiny = art(['Ew.', '.k.'], outline=1, w=16, h=16).crop((0, 0, 5, 4))
    brown = art(['.bb.', 'bkbB', '.ll.'], outline=1, w=16, h=16).crop((0, 0, 6, 5))
    spots = [(1, 6, small), (4, 1, brown), (10, 1, small), (12, 6, brown), (10, 10, small), (3, 11, small),
             (7, 12, tiny), (7, 0, tiny)]
    for (x, y, s) in spots:
        out.alpha_composite(s, (x, y))
    return out


OWL_CARVED = [
    '...b.......b....',
    '...bb.....bB....',
    '..bbbbbbbbbBB...',
    '..bkkkbbkkkBB...',
    '.bkkyykkyykkBB..',
    '.bkyNykkyNykBB..',
    '.bbkkkYYkkkBBB..',
    '.bbbbbYYbbbBBB..',
    '.bBbnbbbbnbBnB..',
    '.bBnbnbbnbnBnB..',
    '.bBbbbnnbbbBnB..',
    '.bBbnbbbbnbBnB..',
    '..BnbnbbnbnBB...',
    '..bbbbbbbbbBB...',
    '...YY.....YY....',
]


def owl_carved():
    """Chouette sculptée dans le bois (16 × 32) sur une souche : notre clin d'œil à la chouette de pierre."""
    g = Grid(16, 32)
    g.stamp(OWL_CARVED, 0, 3)
    g.stamp([
        '..nbbbbbbbbbn...',
        '.nbkkbbbkkbbBn..',
        '.nbbkkkkkkbBBn..',
        '.NnbbbbbbbbBNN..',
        '.NnBnBnBnBnNNN..',
        '.NnBnBnBnBnNNN..',
        '.NnBnBnBnBnNNN..',
        '.NnBnBnBnBnNNN..',
        '.NNnNnNnNnNNNN..',
        'NNN.NNN.NNN.NNN.',
    ], 0, 18)
    return art(g.rows(), w=16, h=32)


def dawn_section():
    for i in range(3):
        add(f'fairy.{i}', fairy(i))
    alias('fairy', 'fairy.0')
    pal = fox_pal()
    add('animal.fox', art(FOX, pal=pal))
    add('animal.fox.walk.1', art(FOX_WALK, pal=pal))
    add('animal.fox.sit', art(FOX_SIT, pal=pal))
    add('animal.fox.sleep', art(FOX_SLEEP, pal=pal))
    alias('fox', 'animal.fox')
    add('animal.hedgehog', art(HEDGEHOG))
    add('animal.hedgehog.walk.1', art(HEDGEHOG_WALK))
    alias('hedgehog', 'animal.hedgehog')
    alias('hedgehog.walk.1', 'animal.hedgehog.walk.1')
    for i in range(2):
        add(f'butterfly.rare.{i}', butterfly(i))
    alias('butterfly.rare', 'butterfly.rare.0')
    add('chest.old', old_chest(False))
    add('chest.old.open', old_chest(True))
    add('mushroom.ring', mushroom_ring())
    add('owl.carved', owl_carved())


# ===========================================================================
# 4. Météos spéciales : icônes (style de assets/sprites/ui/icons.png, contour 1 px), étoile filante,
#    brouillard

WEATHER_ICONS = {}

WEATHER_ICONS['warmrain'] = """
.........K.K....
..KKKK..KOK.K...
.KCCCCKKOYYOK...
KCCCCCCCKYYYOK..
KCCCCCCCCKKYOK..
KCCCCCCCCCCKKK..
KGCCCCCCCCCCGK..
.KGGGGGGGGGGGK..
..KKKKKKKKKKK...
................
..KA...KO...KA..
..KA...KO...KA..
.KA...KO...KA...
.KA...KO...KA...
................
................
"""

WEATHER_ICONS['fog'] = """
................
.....KKKK.......
....KCCCCKKK....
..KKCCCCCCCCK...
.KCCCCCCCCCCCK..
.KGGGGGGGGGGGK..
..KKKKKKKKKKK...
................
.KKKKKKKKKKKK...
KCCCCCCCCCCCCK..
.KKKKKKKKKKKKKK.
...KCCCCCCCCCCCK
...KKKKKKKKKKKK.
.KKKKKKKKK......
KGGGGGGGGGK.....
.KKKKKKKKK......
"""

WEATHER_ICONS['shootingstar'] = """
................
..........KK....
.........KYK....
........KYYK....
....KKKKYYYOKKK.
....KWYYYYYYYOK.
.....KYYYYYYOK..
...KLKKYYYYOK...
..KLK.KYYOYOK...
.KLK.KYOKKKOK...
.KK.KLKK...KK...
...KLK..........
..KLK...........
..KK............
................
................
"""

WEATHER_ICONS['goldenhour'] = """
................
.......KK.......
..KK...OK...KK..
..KOK.......KOK.
.......KK.......
....KKKOOKKK....
...KOYYYYYYOK...
...KYWYYYYYOK...
KKKKYYYYYYYOKKKK
KAAAAAAAAAAAAAAK
KKKKKKKKKKKKKKKK
.KRRRRRRRRRRRRK.
..KKKKKKKKKKKK..
...KPPPPPPPPK...
....KKKKKKKK....
................
"""

WEATHER_ICONS['rainbow'] = """
................
................
....KKKKKKKK....
..KKRRRRRRRRKK..
.KRRAAAAAAAARRK.
KRAAYYYYYYYYAARK
KRAYYVVVVVVYYARK
KRAYVVBBBBVVYARK
KRAYVBKKKKBVYARK
KKKKVBK..KBVKKK.
KCCCKKK..KKKCCCK
KCCCCCK..KCCCCCK
.KGGGK....KGGGK.
..KKK......KKK..
................
................
"""

WEATHER_ICONS['mushroom'] = """
................
................
.....KKKKKK.....
...KKRRRRRRKK...
..KRRWWRRRRRRK..
.KRRWWRRRWWRRRK.
.KRRRRRRRWWRRrK.
.KrRRRWRRRRRrrK.
..KKKKKKKKKKKK..
.....KwwwwK.....
.....KwwwwK..K..
.....KwwwCK.KVK.
....KwwwwCK.KVK.
..KKVKKKKKKKVvK.
..KVVVVVVVVVVK..
...KKKKKKKKKK...
"""


def weather_icon(src):
    lines = [l for l in src.strip('\n').split('\n')]
    assert len(lines) == 16 and all(len(l) == 16 for l in lines), src
    out = img()
    px = out.load()
    for y, line in enumerate(lines):
        for x, ch in enumerate(line):
            c = gi.PAL[ch]
            if c:
                px[x, y] = c + (255,)
    return out


def shooting_star(frame):
    """Étoile filante (32 × 16) : tête lumineuse en haut à droite, traînée qui s'estompe vers le bas à gauche."""
    out = img(32, 16)
    px = out.load()
    hx, hy = 25, 4
    for i in range(24):
        x, y = hx - i, hy + i * 0.42
        a = int(255 * (1 - i / 24) ** 1.3)
        a = (a // 32) * 32
        if a <= 0:
            continue
        col = PAL['T'] if i < 7 else PAL['w'] if i < 14 else PAL['c']
        px[x, round(y)] = col + (a,)
        if i < 14 and round(y) + 1 < 16:
            px[x, round(y) + 1] = (PAL['i'] if i < 6 else PAL['c']) + (max(0, a - 64),)
        if i < 6 and round(y) - 1 >= 0:
            px[x, round(y) - 1] = PAL['T'] + (max(0, a - 96),)
    # étincelles de la traînée (changent d'une image à l'autre)
    sp = [(16, 6), (10, 9)] if frame == 0 else [(19, 7), (13, 7), (8, 11)]
    for (x, y) in sp:
        px[x, y] = PAL['w'] + (190,)
    head = art(['.T.', 'TwT', '.T.'] if frame == 0 else ['..i..', '..T..', 'iTwTi', '..T..', '..i..'],
               outline=0, w=16, h=16)
    k = 1 if frame == 0 else 2
    out.alpha_composite(head.crop((0, 0, 2 * k + 1, 2 * k + 1)), (hx - k, hy - k))
    return glow(out, hx + 0.5, hy + 0.5, 4.5, color=(255, 250, 220), alpha=150)


def fog_tile(size=32, seed=7):
    """Voile de brouillard raccordable (bruit de valeur périodique), blanc bleuté semi-transparent."""
    import random
    rnd = random.Random(seed)
    def lattice(n):
        return [[rnd.random() for _ in range(n)] for _ in range(n)]
    octaves = [(2, 0.55, lattice(2)), (4, 0.3, lattice(4)), (8, 0.15, lattice(8))]

    def noise(x, y):
        v = 0
        for n, amp, lat in octaves:
            fx, fy = x / size * n, y / size * n
            x0, y0 = int(fx) % n, int(fy) % n
            x1, y1 = (x0 + 1) % n, (y0 + 1) % n
            tx, ty = fx - int(fx), fy - int(fy)
            tx, ty = tx * tx * (3 - 2 * tx), ty * ty * (3 - 2 * ty)
            a = lat[y0][x0] * (1 - tx) + lat[y0][x1] * tx
            b = lat[y1][x0] * (1 - tx) + lat[y1][x1] * tx
            v += amp * (a * (1 - ty) + b * ty)
        return v
    out = img(size, size)
    px = out.load()
    for y in range(size):
        for x in range(size):
            v = noise(x, y)
            # paliers : 4 niveaux d'opacité (rendu pixel, pas de dégradé lisse)
            level = 0 if v < 0.38 else 1 if v < 0.48 else 2 if v < 0.58 else 3
            alpha = (22, 40, 58, 76)[level]
            px[x, y] = PAL['W'] + (alpha,)
    return out


def weather_section():
    for name in ('warmrain', 'fog', 'shootingstar', 'goldenhour', 'rainbow', 'mushroom'):
        add(f'icon.weather.{name}', weather_icon(WEATHER_ICONS[name]))
    for i in range(2):
        add(f'star.shooting.{i}', shooting_star(i))
    alias('star.shooting', 'star.shooting.0')
    add('fog', fog_tile(32))


# ===========================================================================
# 5. Trouvailles au défrichage

def old_well():
    """Vieux puits (16 × 32) : margelle de pierres moussues, toit de bois, seau et corde."""
    g = Grid(16, 32)
    # toit
    g.stamp([
        '......NN........',
        '....NNnnNN......',
        '..NNnbbbbnNN....',
        'NNnbbbbbbbbnNN..',
        'nnnnnnnnnnnnnn..',
    ], 1, 4)
    # poteaux
    for y in range(9, 21):
        g.set(3, y, 'n'); g.set(4, y, 'N')
        g.set(12, y, 'n'); g.set(13, y, 'N')
    # treuil et corde, seau
    g.rect(5, 11, 11, 11, 'U')
    g.set(8, 12, 'k'); g.set(8, 13, 'k'); g.set(8, 14, 'k')
    g.stamp(['.SSS.', 'SsssM', '.MMM.'], 6, 15)
    # margelle
    stones = [
        '.ssSsssSssSssS.',
        'sWsSsWsSsWmSsSM',
        'SSSMSSSMmmSMSSM',
        'sssSmssSssSsmSM',
        'sWsSsWsSsWsSsWM',
        'SSMMSSMmSSMMSSM',
        '.SMMSMMSMMSMMS.',
    ]
    g.stamp(stones, 0, 21)
    # eau sombre en haut de la margelle
    g.rect(2, 20, 12, 20, 'z')
    g.set(5, 20, 'C')
    # mousse et lierre
    for (x, y) in ((1, 21), (2, 22), (13, 23), (12, 24), (4, 26), (5, 26)):
        g.set(x, y, 'm')
    return art(g.rows(), w=16, h=32)


def old_statue():
    """Petite statue ancienne (16 × 16) : lièvre de pierre assis sur un socle, moussu."""
    rows = [
        '................',
        '..........sS....',
        '.........WsS.sS.',
        '.........WsSWsS.',
        '.........WsssS..',
        '........WssMsSs.',
        '........ssssssS.',
        '.....sWWsssssS..',
        '....sWsssssssS..',
        '...WWsssssssSS..',
        '...sssssssssSm..',
        '...msssssssSSm..',
        '..SSSSSSSSSSSS..',
        '..WsssmssssssM..',
        '..SSMMSSmSMMSM..',
    ]
    return art([r[1:] + '.' for r in rows])


def coin_pot():
    rows = [
        '................',
        '.....T.i........',
        '....yiyyiy......',
        '...iyYiyyYiy....',
        '..yiyyYiyiyYy...',
        '..nbbbbbbbbbn...',
        '..NnnnnnnnnnN...',
        '...nbbbbbbbN....',
        '..nbbkbbbbbBN...',
        '..nbkbbbbbbBN...',
        '..nbbbbbbbBBN...',
        '...nbbbbbBBN....',
        '....NNNNNNN.....',
        '................',
        '................',
        '................',
    ]
    im = art(rows)
    im = mini_sparkle(im, 12, 3)
    return im


def seed_jar():
    """Bocal de graines anciennes : verre, bouchon de liège, graines de couleurs, étiquette."""
    rows = [
        '................',
        '.....bbbbbb.....',
        '.....bkkkbB.....',
        '....SSSSSSSS....',
        '....cwcccccS....',
        '...cwccccccCS...',
        '...cwRyGbRyCS...',
        '...cwlllllRCS...',
        '...cRlnnnlGCS...',
        '...cylllllyCS...',
        '...cGbRyGbRCS...',
        '...cyGbRyGbCS...',
        '....CCCCCCCS....',
        '................',
        '................',
        '................',
    ]
    im = art(rows)
    return im


LAMB = [
    '................',
    '................',
    '................',
    '................',
    '..........wwww..',
    '.........wwkkZ..',
    '....wwww.wkkkkL.',
    '..wwwwwwwwkkkk..',
    '.wwwswwwwwwkk...',
    '.wwwwwwswwwww...',
    '.swwwwwwwwwwE...',
    '..sswwwwwwwsE...',
    '...k.k...k.k....',
    '...N.N...N.N....',
]
LAMB_WALK = LAMB[:12] + ['....k.k.k..k....', '....N.N.N..N....']


def stump_find():
    base = CAS['land.stump'].copy()
    # reflet doré entre les racines
    base = paint(base, ['TY'], 11, 12) if base.getpixel((11, 12))[3] else base
    return mini_sparkle(base, 12, 4, big=True)


def finds_section():
    alias('find.chest', 'chest.old')
    alias('find.chest.open', 'chest.old.open')
    add('find.well', old_well())
    add('find.statue', old_statue())
    add('find.coins', coin_pot())
    add('find.seedjar', seed_jar())
    add('find.lostlamb', art(LAMB))
    add('find.lostlamb.walk.1', art(LAMB_WALK))
    add('land.stump.find', stump_find())


# ===========================================================================
# 6. Effets de récolte « juteuse »

COIN_FRAMES = [
    gi.ICONS['coin'],
    """
................
................
......KKKK......
.....KYYYOK.....
....KYWYYYOK....
....KWYKKYOK....
....KYKYOKOK....
....KYKYOKOK....
....KYKYOKOK....
....KYKOOKOK....
....KOYKKYOK....
....KOYYYOOK....
.....KOOOOK.....
......KKKK......
................
................
""",
    """
................
................
.......KK.......
......KYOK......
......KWOK......
......KYOK......
......KYOK......
......KYOK......
......KYOK......
......KYOK......
......KYOK......
......KYOK......
......KOOK......
.......KK.......
................
................
""",
]


def coin_frame(k):
    """Pièce d'or (même dessin que l'icône « coin » du compteur) qui tourne : 0 face, 1 trois-quarts,
    2 tranche, 3 trois-quarts vu de l'autre côté."""
    if k == 3:
        return flip(weather_icon(COIN_FRAMES[1]))
    return weather_icon(COIN_FRAMES[k])


def burst():
    """Éclat en étoile (récolte, combo) : rayons jaunes et blancs, cœur blanc."""
    g = Grid(16, 16)
    for ang in range(0, 360, 45):
        a = math.radians(ang)
        long = ang % 90 == 0
        n = 7 if long else 5
        for r in range(2, n + 1):
            x, y = round(7.5 + r * math.cos(a)), round(7.5 + r * math.sin(a))
            g.set(x, y, 'i' if r < n - 1 else 'y')
    g.stamp(['.ii.', 'iwwi', 'iwwi', '.ii.'], 6, 6)
    return art(g.rows(), outline=1)


def note():
    rows = [
        '................',
        '................',
        '.......wwww.....',
        '.......wsssw....',
        '.......w..ssw...',
        '.......w...sw...',
        '.......w....s...',
        '.......w........',
        '.......w........',
        '....wwww........',
        '...wwwwws.......',
        '...wwwwws.......',
        '....ssss........',
    ]
    return art(rows, outline=1)


def fx_section():
    for k in range(4):
        add(f'fx.coin.{k}', coin_frame(k))
    add('fx.burst', burst())
    add('fx.note', note())


SECTIONS = [giant_section, quality_section, dawn_section, weather_section, finds_section, fx_section]


# ===========================================================================
# Assemblage

def pack():
    """Premier emplacement libre (lecture ligne par ligne), les grands sprites d'abord (ordre déterministe)."""
    used = set()
    pos = {}
    order = sorted(range(len(ENTRIES)), key=lambda i: (-(ENTRIES[i][1].height * ENTRIES[i][1].width), i))
    for i in order:
        name, im = ENTRIES[i]
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
    return pos, rows


def js_entry(c, r, w, h):
    return f"{{ sheet: 'lot2', col: {c}, row: {r}" + (f', w: {w}, h: {h}' if (w, h) != (1, 1) else '') + ' }'


def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument('--contact', help='dossier où écrire des planches de contrôle ×6')
    args = ap.parse_args()
    for fn in SECTIONS:
        fn()
    pos, rows = pack()
    sheet = img(SHEET_COLS * T, rows * T)
    for name, im in ENTRIES:
        c, r, w, h = pos[name]
        sheet.alpha_composite(im, (c * T, r * T))
    sheet.save(HERE / 'lot2.png', optimize=True)
    lines = ['  // Généré par assets/sprites/generate-lot2.py — ne pas modifier à la main.',
             'const lot2 = {']
    for name, _ in ENTRIES:
        lines.append(f"  '{name}': {js_entry(*pos[name])},")
    for name, target in ALIASES:
        lines.append(f"  '{name}': {js_entry(*pos[target])},")
    lines.append('};')
    block = '\n'.join(lines)
    atlas = ROOT / 'src' / 'render' / 'atlas.js'
    src = atlas.read_text()
    if '// <lot2:auto>' not in src:
        raise SystemExit('marqueurs // <lot2:auto> absents de src/render/atlas.js')
    new = re.sub(r'(// <lot2:auto>\n).*?(// </lot2:auto>)', lambda m: m.group(1) + block + '\n' + m.group(2),
                 src, flags=re.S)
    atlas.write_text(new)
    print(f'écrit {HERE / "lot2.png"} ({SHEET_COLS} × {rows} tuiles, {len(ENTRIES)} sprites, {len(ALIASES)} alias)')
    if args.contact:
        contact_sheets(Path(args.contact))


def contact_sheets(folder, scale=6):
    """Planches de contrôle : chaque groupe à ×scale, à côté d'originaux Kenney (et de l'existant)."""
    folder.mkdir(parents=True, exist_ok=True)
    refs = {
        'giant': [tile(6, 0), tile(6, 3), tile(6, 4), V3S['crop.pumpkin.4'], V3S['crop.pumpkin.icon'], tile(8, 2)],
        'quality': [tile(8, 0), tile(8, 3), V3S['icon.star'], V3S['crop.pumpkin.icon']],
        'dawn': [tile(0, 10), tile(2, 10), CAS['animal.pig'], CAS['animal.rabbit.brown'], V3S['animal.goat']],
        'weather': [weather_icon(gi.ICONS[n]) for n in ('sunny', 'cloudy', 'rain', 'storm')],
        'finds': [tile(7, 6), CAS['land.stump'], tile(0, 10), CAS['embellish.statue']],
        'fx': [weather_icon(gi.ICONS['coin']), V3S['icon.star'], tile(8, 0)],
    }
    groups = {k: [] for k in refs}
    for name, im in ENTRIES:
        k = ('giant' if name.endswith('.giant') else
             'quality' if name.startswith(('quality', 'fx.sparkle')) or name.endswith('.gold') else
             'dawn' if name.startswith(('fairy', 'animal', 'butterfly', 'chest', 'mushroom', 'owl')) else
             'weather' if name.startswith(('icon.weather', 'star.', 'fog')) else
             'finds' if name.startswith(('find', 'land')) else 'fx')
        groups[k].append(im)
    for key, ims in groups.items():
        for bgname, bg in (('', (132, 198, 105, 255)), ('-dark', (40, 44, 70, 255))):
            if bgname and key not in ('weather', 'quality', 'dawn'):
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
            if key == 'giant':  # terre de parcelle sous les légumes géants
                pass
            for (x, y, im) in placed:
                out.alpha_composite(im.resize((im.width * scale, im.height * scale), Image.NEAREST), (x + 4, y + 4))
            out.save(folder / f'art-lot2-{key}{bgname}.png')


if __name__ == '__main__':
    main()
