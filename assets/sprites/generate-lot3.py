#!/usr/bin/env python3
"""Génère assets/sprites/lot3.png : sprites du « lot 3 » (variété) dans le style Kenney (CC0).

Contenu (voir docs/ARCHITECTURE.md, « Lot 3 — contrats », tableau des sprites, et docs/GAME_DESIGN.md § 16) :
  - tableau du village : board.village (32 × 32), feuilles board.note / .kept / .done ;
  - charrette du marché tirée par un âne : cart.market, cart.market.1 (32 × 32) ;
  - cagettes manquantes : crate.apple, crate.pea, crate.melon, crate.leek ;
  - Basile le colporteur : roulotte merchant.wagon / .1 (32 × 32), npc.merchant / .walk, portrait.merchant ;
  - cultures rares (petits pois, melon, poireau) : crop.<id>.1..4, .icon, .dead, .icon.gold, seedbag.<id>,
    sack.<id>, crop.<id>.giant (32 × 32) ;
  - portraits 32 × 32 des 12 clients du tableau (portrait.client.<id>) et des 9 visiteurs des thèmes
    (portrait.theme.<id>) ;
  - icônes 16 × 16 (style de assets/sprites/ui/icons.png) : onglets icon.board / cart / cards / challenge /
    merchant / theme / rare, cartes icon.card.<id>, défis icon.challenge.<id>, médailles medal.*, objets du
    colporteur item.<id>, thèmes icon.theme.<id> ;
  - petits stands des fêtes de thème fair.theme.<id> et décors trouvés lantern.peddler, weathervane.rooster,
    sign.magazine.

Même méthode que generate-lot2.py (dont on réutilise la palette et les outils, eux-mêmes repris de
generate-v3.py et generate-career.py) : dessins ASCII ou construits par programme (une lettre = une couleur de
la palette Kenney), contour sombre (63, 38, 49) de 2 px autour de la silhouette (1 px pour les icônes),
lumière venant d'en haut à gauche.

Le script :
  1. dessine chaque sprite ;
  2. les range dans la planche (placement automatique, déterministe, 16 tuiles de large) ;
  3. écrit assets/sprites/lot3.png ;
  4. réécrit, dans src/render/atlas.js, le bloc compris entre « // <lot3:auto> » et « // </lot3:auto> ».

Relancer :  python3 assets/sprites/generate-lot3.py   (nécessite Pillow)
Planches de contrôle (×6, avec des originaux) : python3 assets/sprites/generate-lot3.py --contact DOSSIER
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


g2 = _load('gen_lot2', HERE / 'generate-lot2.py')
g3 = g2.g3
gc = _load('gen_career', HERE / 'generate-career.py')

T = 16
SHEET_COLS = 16
OUT = g3.OUT
FARM, TOWN = g3.FARM, g3.TOWN
img, tile, flip, lum, compose, wither = g3.img, g3.tile, g3.flip, g3.lum, g3.compose, g3.wither
V3S, CAS = g2.V3S, g2.CAS
Grid = g2.Grid
over = g2.over

# Palette : celle du lot 2 (Kenney + ajouts carrière/lot 2) et quelques teintes de plus.
PAL = dict(g2.PAL)
PAL.update({
    # melon (jaune-vert brodé)
    '1': (236, 234, 150),
    '2': (199, 205, 98),
    '3': (146, 160, 64),
    '4': (104, 120, 52),
    # poireau (feuilles bleu-vert)
    '5': (146, 196, 170),
    '6': (96, 152, 136),
    '7': (62, 110, 104),
    # cuivre
    '8': (240, 160, 110),
    '9': (196, 102, 64),
    '0': (140, 66, 46),
    # bleu, blanc, rouge (écharpe du maire), bleu marine, fourrure
    't': (60, 90, 170),
    '#': (98, 72, 58),      # fourrure sombre
    '%': (150, 116, 90),    # fourrure claire
    '&': (40, 40, 52),      # noir (chapeaux, appareil photo)
    '+': (70, 70, 88),      # noir éclairé
})


def art(rows, outline=2, w=None, h=None, pal=None):
    return g3.art(rows, outline=outline, pal=pal or PAL, w=w, h=h)


def icon(src, pal=None):
    """Icône 16 × 16 au contour fin (1 px), comme assets/sprites/ui/icons.png. `src` : texte de lignes
    (« . » transparent ; « A » trait sombre intérieur)."""
    rows = [l for l in src.strip('\n').split('\n')]
    assert len(rows) <= 16 and all(len(r) <= 16 for r in rows), src
    return art(rows, outline=1, w=16, h=16, pal=pal)


def paint(im, rows, x0=0, y0=0):
    """Peint un petit dessin ASCII par-dessus (sans contour ; « . » = inchangé, « _ » = transparent)."""
    px = im.load()
    for y, line in enumerate(rows):
        for x, ch in enumerate(line):
            if ch in '. ':
                continue
            px[x0 + x, y0 + y] = (0, 0, 0, 0) if ch == '_' else PAL[ch] + (255,)
    return im


def rows_of(src):
    return [l for l in src.strip('\n').split('\n')]


def shift(im, dx, dy):
    out = img(im.width, im.height)
    out.paste(im, (dx, dy), im)
    return out


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
# 1. Cultures rares : petits pois, melon, poireau
#    Étapes 1..4 (l'étape 0 = tuile commune « graines semées »), icône, fané, icône dorée, sachet, sac,
#    cagette, légume géant 32 × 32.

SPROUT_A, SPROUT_B = g3.SPROUT_A, g3.SPROUT_B
LS, LM, LB, LX = g3.LS, g3.LM, g3.LB, g3.LX
FLOWER_W, FLOWER_Y = g3.FLOWER_W, g3.FLOWER_Y


def stake(h):
    """Rame de petits pois (branche de noisetier plantée) : 1 px de large, h px de haut."""
    return ['b'] + ['n'] * (h - 1)


PEA = {
    1: SPROUT_B,
    2: compose([(stake(8), 9, 4), (['d', 'd', 'd'], 7, 9), (LS, 3, 8), (LS, 8, 6), (LS, 5, 10),
                (['.d', 'd.'], 8, 4)]),
    # deux rames, feuilles rondes qui grimpent, fleurs blanches
    3: rows_of("""
................
................
....b......b....
...gnG....wnw...
..gGnGd..wynGg..
..GdnAd...wnGd..
...dnGg...dnGg..
..gGnGGd.gGnGGd.
..GGndd..GGndd..
...wnGg..gdnG...
..wynGGd.GGnGd..
...wndd...dnd...
....nd.....n....
"""),
}
PEA_POD = ['gj', 'jJ', 'jJ', 'jJ', '.J']
PEA[4] = compose([(PEA[3], 0, -1, False), (PEA_POD, 6, 5), (PEA_POD, 12, 7), (PEA_POD, 1, 9), (PEA_POD, 7, 10),
                  (['w', 'y'], 13, 1, False)])

PEA_ICON = """
................
................
................
.............dd.
............dN..
...jjjjjjjjjjj..
..jgGAgGAgGAgGj.
..jGGAGGAGGAGGJ.
..jGdAGdAGdAGdJ.
..AjjjjjjjjjjjA.
...jJJJJJJJJJJ..
....JJJJJJJJJ...
"""

MELON_LEAF = ['.gGG.', 'gGGGd', 'GGdGd', 'GdGdd', '.ddd.']


def melon_ball(g, cx, cy, rx, ry, net=True):
    """Melon brodé jaune-vert : boule ombrée, broderie claire en losanges, côtes sombres."""
    cells = g.ball(cx, cy, rx, ry, '1234', ring='A', light=(-0.5, -0.7, 0.55), cuts=[0.85, 0.45, -0.1])
    if net:
        for (x, y), ch in cells.items():
            if (x + y) % 4 == 0 and (x - y) % 4 == 0 and ch in '23':
                g.set(x, y, '1')
            elif (x + y) % 4 == 2 and (x - y) % 4 == 2 and ch in '34':
                g.set(x, y, '2')
    return cells


def melon_stage(k):
    g = Grid(16, 16)
    if k == 1:
        return SPROUT_A
    if k == 2:
        g.stamp_ring(['d', 'd'], 7, 9)
        g.stamp_ring(LB, 2, 7)
        g.stamp_ring(LB, 9, 6)
        g.stamp_ring(LS, 6, 9)
        g.line(11, 12, 13, 13, 'd')
        return g.rows()
    if k == 3:
        g.stamp_ring(LB, 1, 5)
        g.stamp_ring(LB, 10, 4)
        g.stamp_ring(MELON_LEAF, 5, 3)
        g.stamp_ring(LB, 0, 9)
        g.stamp_ring(LB, 11, 9)
        g.stamp_ring(FLOWER_Y, 11, 1)
        melon_ball(g, 7.5, 11.0, 3.4, 2.8, net=False)
        return g.rows()
    g.stamp_ring(LB, 0, 3)
    g.stamp_ring(LB, 11, 2)
    g.stamp_ring(MELON_LEAF, 5, 1)
    g.stamp_ring(LB, 11, 8)
    g.stamp_ring(FLOWER_Y, 1, 0)
    melon_ball(g, 7.0, 9.5, 5.4, 4.3)
    g.stamp_ring(['.d', 'dN'], 9, 4)
    g.set(4, 7, 'w') if g.get(4, 7) == '1' else None
    return g.rows()


def melon_icon():
    g = Grid(16, 16)
    g.stamp_ring(['..gG.', '.gGGd', 'gGdd.', '.dd..'], 9, 1)
    melon_ball(g, 7.5, 9.0, 5.8, 4.8)
    g.stamp_ring(['dN', 'N.'], 8, 3)
    g.set(4, 6, 'w')
    g.set(5, 6, '1')
    return g.rows()


LEEK = {
    1: rows_of("""
................
................
................
................
................
................
................
.......5........
......56.6......
......5.66......
.......56.......
.......gW.......
"""),
    2: rows_of("""
................
................
................
................
................
................
....5.....7.....
....55..667.....
.....5556.......
......566.......
......gGd.......
......wWs.......
......wWs.......
.......b........
"""),
    3: rows_of("""
................
................
................
...5........7...
...55.5..6.67...
....55.56.667...
.....555667.....
......5566......
......g5Gd......
......wWWs......
......wWWs......
......wWWs......
.......bb.......
"""),
    4: rows_of("""
................
..5..........7..
..55...5....67..
...55..56..667..
....55.56.667...
.....5556667....
......55667.....
......g5G6......
......gGGd......
......wWWs......
......wWWs......
......wWWs......
......wWWs......
.....bwWWsb.....
......b..b......
"""),
}

LEEK_ICON = """
................
............5..6
...........55667
..........55667.
.........556677.
........g56677..
.......gGG677...
......wWGGd.....
.....wWWWs......
....wWWWs.......
...wWWWs........
..wWWWs.........
..WWWs..........
.bWss...........
.b.b............
"""

EMBLEMS = {  # petits dessins 4 × 4 (sans contour) posés sur l'étiquette des sachets et des sacs
    'pea': ['..jd', '.jgJ', 'jgJ.', 'JJ..'],
    'melon': ['.dd.', '1222', '2123', '.33.'],
    'leek': ['...6', '..57', '.Wg.', 'Ws..'],
}


def seedbag(emb):
    t = tile(10, 0).copy()
    g3.clear_label(t, 5, 6, 10, 11)
    paint(t, emb, 6, 7)
    return t


def sack(emb):
    t = tile(9, 0).copy()
    g3.clear_label(t, 5, 7, 10, 12)
    paint(t, emb, 6, 8)
    return t


# --- Légumes géants 32 × 32 (bas du sprite = bas du carré de 2 × 2 parcelles) -------------------------

def giant_pea():
    """Énorme gousse ouverte posée en biais sur ses feuilles : cosse, rangée de gros pois, lèvre avant."""
    g = Grid(32, 32)
    g.layer(g2.leaf_cells(12, 13, 2, 5, 4.2))
    g.layer(g2.leaf_cells(18, 12, 28, 3, 4.0))
    for (x, y) in ((24, 13), (25, 12), (26, 12), (27, 13), (27, 14), (26, 15)):
        g.set(x, y, 'd')
    ax0, ay0, ax1, ay1 = 5.0, 24.0, 27.0, 15.0
    # cosse arrière (intérieur sombre)
    back = {}
    for (x, y), (t, sn) in g2.capsule_cells(ax0, ay0, ax1, ay1, 6.2, 3.4).items():
        back[(x, y)] = 'j' if sn < -0.7 else 'J' if sn < -0.2 else 'd'
    g.layer(back)
    # pois
    for i in range(5):
        t = 0.1 + i * 0.2
        cx, cy = ax0 + (ax1 - ax0) * t, ay0 + (ay1 - ay0) * t - 0.6
        r = 3.4 - 0.25 * i
        g.ball(cx, cy, r, r, 'gjJ', ring='A', light=(-0.5, -0.7, 0.55))
    # lèvre avant (moitié basse de la cosse, devant les pois)
    front = {}
    for (x, y), (t, sn) in g2.capsule_cells(ax0, ay0 + 3.2, ax1, ay1 + 2.6, 4.0, 2.0).items():
        # ne garder que la partie sous l'axe des pois
        tt = ((x + 0.5 - ax0) * (ax1 - ax0) + (y + 0.5 - ay0) * (ay1 - ay0)) / ((ax1 - ax0) ** 2 + (ay1 - ay0) ** 2)
        axis_y = ay0 + (ay1 - ay0) * max(0, min(1, tt))
        if y + 0.5 < axis_y + 2.0:
            continue
        front[(x, y)] = 'g' if sn < -0.45 else 'G' if sn < 0.4 else 'd'
    g.layer(front)
    g.stamp_ring(['.dN', 'dNn', 'Nn.'], 26, 11)
    return art(g.rows(), w=32, h=32)


def giant_melon():
    g = Grid(32, 32)
    g.layer(g2.leaf_cells(11, 13, 2, 5, 4.4))
    g.layer(g2.leaf_cells(20, 12, 30, 6, 4.2))
    for (x, y) in ((4, 15), (3, 16), (3, 17), (4, 18), (5, 18)):
        g.set(x, y, 'd')
    melon_ball(g, 16, 20.5, 12.6, 9.6)
    # côtes (méridiens sombres)
    for y in range(12, 30):
        for x0 in (10, 22):
            pass
    g.stamp_ring(['..dN.', '.dNn.', 'dNn..'], 14, 9)
    for (x, y) in ((9, 15), (10, 14), (11, 14), (8, 16)):
        g.set(x, y, 'w' if (x, y) == (10, 14) else '1')
    return art(g.rows(), w=32, h=32)


def giant_leek():
    """Un poireau énorme, debout : fût blanc rond, collet vert pâle, larges feuilles en éventail."""
    g = Grid(32, 32)
    x, base, top = 16, 29, 2
    shaft_top = 15
    blades = [(-13, 2, '556'), (13, 3, '667'), (-7, 0, '556'), (7, 1, '566'), (0, 0, '567')]
    for (dx, ytop, ramp) in blades:
        cells = {}
        n = shaft_top - ytop
        for i in range(n + 1):
            t = i / n
            cx = x + dx * (t ** 1.6)
            yy = shaft_top - i
            wdt = 2.6 * (1 - t) ** 0.7 + 0.5
            for xx in range(round(cx - wdt), round(cx + wdt) + 1):
                side = (xx + 0.5 - cx) / max(wdt, 0.5)
                cells[(xx, yy)] = ramp[0] if side < -0.35 else ramp[2] if side > 0.45 else ramp[1]
        g.layer(cells)
    cells = {}
    for y in range(shaft_top - 1, base + 1):
        for dx in range(-4, 4):
            side = (dx + 0.5) / 4
            ch = 'w' if side < -0.2 else 'W' if side < 0.5 else 's'
            if y < shaft_top + 2:
                ch = 'g' if side < 0 else 'j' if side < 0.5 else 'G'
            elif y < shaft_top + 4:
                ch = 'T' if side < -0.2 else 'g' if side < 0.5 else 'G'
            cells[(x + dx, y)] = ch
    g.layer(cells)
    for (dx, dy) in ((-3, 1), (-1, 2), (1, 1), (2, 2), (-4, 2)):
        g.set(x + dx, base + dy, 'b')
    return art(g.rows(), w=32, h=32)


def crop_section():
    specs = {
        'pea': (PEA, rows_of(PEA_ICON)),
        'melon': ({k: melon_stage(k) for k in (1, 2, 3, 4)}, melon_icon()),
        'leek': (LEEK, rows_of(LEEK_ICON)),
    }
    for cid, (stages, icon_rows) in specs.items():
        ims = {k: art(v) for k, v in stages.items()}
        for k in (1, 2, 3, 4):
            add(f'crop.{cid}.{k}', ims[k])
        ic = art(icon_rows)
        add(f'crop.{cid}.icon', ic)
        add(f'crop.{cid}.dead', wither(ims[4] if cid != 'pea' else ims[3]))
        add(f'crop.{cid}.icon.gold', g2.mini_sparkle(g2.golden(ic), 13, 3))
        add(f'seedbag.{cid}', seedbag(EMBLEMS[cid]))
        add(f'sack.{cid}', sack(EMBLEMS[cid]))
        add(f'crate.{cid}', g3.crate(ic, -1 if cid == 'melon' else -2))
    add('crate.apple', crate_apples())
    add('crop.pea.giant', giant_pea())
    add('crop.melon.giant', giant_melon())
    add('crop.leek.giant', giant_leek())


APPLE_S = ['..N..', '.rRRR.', 'rewRRq', 'rRRRRq', 'RRRRqq', '.qqqq.']


def crate_apples():
    """Cagette de pommes : trois petites pommes entassées."""
    heap = art(compose([(APPLE_S, 0, 4), (APPLE_S, 10, 4), (APPLE_S, 5, 2)]), outline=1)
    return g3.crate(heap, 0)


# ===========================================================================
# 2. Scène : tableau du village, feuilles, charrette et âne, roulotte et Basile, décors, stands de fête

def wood_post(g, x0, y0, y1, w=3):
    for y in range(y0, y1 + 1):
        for i in range(w):
            g.set(x0 + i, y, 'b' if i == 0 else 'N' if i == w - 1 else 'n')


def board_village():
    """Panneau d'affichage : deux poteaux, petit toit de bardeaux, grande planche claire (3 places)."""
    g = Grid(32, 32)
    wood_post(g, 5, 9, 30)
    wood_post(g, 24, 9, 30)
    # planche (cadre brun, lames claires)
    g.rect(2, 10, 29, 24, 'B')
    g.rect(3, 11, 28, 23, 'l')
    for y in (15, 19):
        for x in range(3, 29):
            g.set(x, y, 'k')
    for x in range(3, 29):
        g.set(x, 23, 'k')
    for y in range(11, 24):
        g.set(28, y, 'k')
    for (x, y) in ((7, 13), (19, 17), (11, 21), (24, 12)):   # nœuds du bois
        g.set(x, y, 'k')
    # toit de bardeaux (rouge Kenney), faîtage sombre
    for i, y in enumerate(range(3, 9)):
        x0, x1 = 6 - i, 25 + i
        for x in range(x0, x1 + 1):
            if y == 3:
                ch = 'r'
            else:
                ch = 'R' if ((x + (y % 2) * 2) // 4) % 2 == 0 else 'r'
                if (x + (y % 2) * 2) % 4 == 3:
                    ch = 'q'
            g.set(x, y, ch)
    for x in range(0, 32):
        if g.get(x, 8) != '.':
            g.set(x, 8, 'q')
    for x in range(3, 29):
        g.set(x, 9, 'N')        # ombre du toit sur la planche
    g.rect(6, 2, 25, 2, 'q')
    # touffes d'herbe au pied des poteaux
    for (x, y) in ((4, 30), (8, 30), (23, 30), (27, 30), (3, 29), (28, 29)):
        g.set(x, y, 'G' if (x + y) % 2 else 'd')
    return art(g.rows(), w=32, h=32)


NOTE_BASE = """
................
................
....wwwwwwww....
...AwwwwwwwsA...
...wwSSSSSwws...
...wwwwwwwwws...
...wwSSSSwwws...
...wwwwwwwwws...
...wwSSSSSSws...
...wwwwwwwwws...
...wwSSSwwwws...
...wwwwwwwwws...
...ssssssssss...
"""


def board_note(kind):
    g = Grid(16, 16)
    g.stamp(rows_of(NOTE_BASE), 0, 0)
    if kind == 'plain':      # petite punaise grise
        g.stamp(['.S.', 'SWS', '.M.'], 6, 1)
    elif kind == 'kept':     # grosse punaise rouge
        g.stamp(['.EE.', 'EpEq', 'EEqq', '.qq.'], 6, 0)
        g.set(7, 4, 'S')
    else:                    # tampon vert « ✓ »
        g.stamp(['.S.', 'SWS', '.M.'], 6, 1)
        g.stamp(['.......D', '......DD', '.D...DD.', '.DD.DD..', '..DDD...', '...D....'], 4, 6)
    return art(g.rows(), outline=1, w=16, h=16)


DONKEY = [  # âne gris de profil, regard vers la droite (14 × 17), mauvais pied levé : jambes à part
    '.........xA.xA..',
    '.........sx.sx..',
    '.........sSxsS..',
    '........sSSSSS..',
    '.......xsSZSSSWW',
    '......xxsSSSSWWW',
    '.....xxsSSSSWWZW',
    '....xxsSSS.SSWW.',
    '...xsSSSS...MM..',
    'sSSSSSSSSS......',
    'sSSSSSSSSSS.....',
    'SSSSSSSSSSM.....',
    '.MMMMMMMMMM.....',
]
DONKEY_LEGS = [
    ['.SM.SM...SM.SM.', '.SM.SM...SM.SM.', '.SM.SM...SM.SM.', '.ZZ.ZZ...ZZ.ZZ.'],
    ['.SM..SM.SM..SM.', '..SM.SM..SM.SM.', '..SM..ZZ.SM..ZZ', '..ZZ.....ZZ....'],
]


def wheel(g, cx, cy, r, frame=0):
    """Roue en bois : jante sombre, fond clair, rayons sombres (tournés de 45° à l'image 1), moyeu doré."""
    for y in range(int(cy - r) - 1, int(cy + r) + 2):
        for x in range(int(cx - r) - 1, int(cx + r) + 2):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            if d <= r:
                g.set(x, y, 'N' if d > r - 1.4 else 'b')
    angles = (0, 90, 180, 270) if frame == 0 else (45, 135, 225, 315)
    for a in angles:
        for k10 in range(0, int(r * 10), 3):
            k = k10 / 10
            x = cx - 0.5 + k * math.cos(math.radians(a))
            y = cy - 0.5 + k * math.sin(math.radians(a))
            g.set(round(x), round(y), 'n')
    g.rect(round(cx - 1), round(cy - 1), round(cx), round(cy), 'Y')


def cart_market(frame=0):
    g = Grid(32, 32)
    # légumes qui dépassent de la caisse
    g.ball(5.0, 11.0, 3.0, 2.6, 'gGd', ring='A')
    g.ball(10.5, 10.5, 3.2, 3.0, 'yYo', ring='A')
    g.ball(15.0, 11.5, 2.4, 2.2, 'rRq', ring='A')
    g.set(10, 7, 'd'); g.set(11, 7, 'N')
    # caisse à ridelles
    g.rect(1, 13, 18, 21, 'B')
    for x in range(1, 19):
        g.set(x, 13, 'b'); g.set(x, 17, 'b')
    for x in (1, 6, 12, 18):
        for y in range(13, 22):
            g.set(x, y, 'n')
    for x in range(1, 19):
        g.set(x, 21, 'N')
    # brancards jusqu'à l'âne
    g.line(18, 18, 25, 19, 'n')
    g.line(18, 19, 25, 20, 'N')
    wheel(g, 8, 23, 5.2, frame)
    # âne
    don = Grid(16, 17)
    don.stamp(DONKEY, 0, 0)
    don.stamp(DONKEY_LEGS[frame], 0, 13)
    rows = don.rows()
    for y, line in enumerate(rows):
        for x, ch in enumerate(line):
            if ch != '.':
                g.set(16 + x, 11 + y, ch)
    # harnais rouge
    for (x, y) in ((24, 18), (24, 19), (24, 20), (24, 21), (24, 22), (23, 20)):
        g.set(x, y, 'R')
    return art(g.rows(), w=32, h=32)


def merchant_wagon(frame=0):
    """Roulotte du colporteur : caisse peinte en vert, toit arrondi bordeaux, auvent rayé rouge et crème,
    lanterne. Image 1 : auvent déployé et étal (sachets, bocaux) devant la roulotte."""
    g = Grid(32, 32)
    # toit arrondi
    for (x, y) in g.cells_ellipse(16, 10, 14.5, 7):
        if y <= 9:
            g.set(x, y, 'q' if y >= 8 else 'R' if (x + y) % 5 else 'q')
    for x in range(2, 30):
        g.set(x, 3, 'r') if g.get(x, 3) != '.' else None
    for (x, y) in g.cells_ellipse(16, 10, 14.5, 7):
        if y == 4 and g.get(x, y) != '.':
            g.set(x, y, 'r')
    # caisse
    g.rect(3, 10, 28, 23, 'D')
    for x in range(3, 29):
        g.set(x, 10, 'y'); g.set(x, 23, 'Y')
    for y in range(10, 24):
        g.set(3, y, 'y'); g.set(28, y, 'Y')
    for x in range(4, 28):
        for y in range(11, 23):
            if x % 4 == 0:
                g.set(x, y, 'd')
    # porte (à gauche) et fenêtre à volets
    g.rect(5, 12, 9, 22, 'n')
    g.rect(6, 13, 8, 21, 'b')
    g.set(8, 17, 'y')
    g.rect(13, 13, 22, 19, 'Y')
    g.rect(14, 14, 21, 18, 'c')
    g.rect(14, 14, 15, 15, 'w')
    g.rect(17, 14, 18, 18, 'Y') if frame == 0 else None
    if frame == 0:   # volets fermés à moitié
        g.rect(14, 14, 16, 18, 'R'); g.rect(19, 14, 21, 18, 'R')
        g.set(15, 16, 'y'); g.set(20, 16, 'y')
    # dessous, marchepied, roues
    for x in range(3, 29):
        g.set(x, 24, 'N')
    g.rect(1, 21, 3, 22, 'b'); g.rect(0, 23, 2, 24, 'n')
    wheel(g, 9, 25, 5.4)
    wheel(g, 23, 26, 4.4)
    # lanterne accrochée à l'avant
    g.set(29, 9, 'N'); g.set(30, 9, 'N'); g.set(30, 10, 'N')
    g.stamp(['.o.', 'oio', 'oyo', 'oYo', '.o.'], 29, 11)
    # auvent
    if frame == 0:
        for x in range(11, 25):
            c = 'E' if (x // 2) % 2 == 0 else 'w'
            g.set(x, 11, c); g.set(x, 12, 'q' if c == 'E' else 's')
    else:
        for i, y in enumerate(range(10, 15)):
            for x in range(10 + 0, 26):
                c = 'E' if (x // 2) % 2 == 0 else 'w'
                g.set(x, y, c if i < 4 else ('q' if c == 'E' else 's'))
        for x in range(10, 26):
            if x % 2 == 0:
                g.set(x, 15, 'E' if (x // 2) % 2 == 0 else 'w')
        # piquets de l'auvent et étal (au-dessus des roues)
        for x in (11, 24):
            for y in range(15, 21):
                g.set(x, y, 'n')
        g.rect(10, 18, 25, 20, 'b')
        for x in range(10, 26):
            g.set(x, 18, 'k'); g.set(x, 20, 'B')
        # marchandises : sachets, bocal, pomme
        g.stamp(['ll', 'kk', 'bk'], 12, 15)
        g.stamp(['.n.', 'ccc', 'cyc'], 15, 15)
        g.stamp(['ll', 'kk', 'bk'], 19, 15)
        g.stamp(['.N', 'Rr', 'RR'], 22, 15)
    return art(g.rows(), w=32, h=32)


# Basile en 16 × 16 (gabarit des fermiers de generate-career.py) : grand chapeau violet à plume rouge,
# barbe brune, chemise jaune, gilet vert, sac à dos de cuir (bretelles et sac qui dépasse des épaules)
BASILE_ROWS = [
    '.....AAAAAA.AAA.',
    '....AAAAAAAAApA.',
    '.AAAAhhHHhhApqA.',
    'AAAAAhhhhhhpqAAA',
    'AAHhAbbbbbbAhHAA',
    'AAHhhhhhhhhhhHAA',
    'AAAHHHHHHHHHHAAA',
    '.AAAssEsssEsAAA.',
    '..AASSESSSESAA..',
    '.AAANNsssNNAAA..',
    'AIAACONNNNOCAIA.',
    'AIICCOCCCCOCCIIA',
    'AISScOoOOoOcSSIA',
    'AASSAOOOOOOASSAA',
    'AAAAAOOAAOOAAAAA',
    '.AAAAFFAAFFAAAA.',
]
BASILE_COLORS = {'H': 'Q', 'h': 'a', 'b': 'y', 'C': 'i', 'c': 'y', 'O': 'J', 'o': 'y'}


def basile(pose='idle'):
    rows = gc.posed(BASILE_ROWS, pose)
    extra = {k: PAL[v] for k, v in BASILE_COLORS.items()}
    extra.update({'p': PAL['p'], 'q': PAL['q'], 'N': PAL['N'], 'I': PAL['I']})
    return gc.person(rows, 0, 'brown', 'medium', extra=extra)


def lantern_peddler():
    """Lanterne de colporteur pendue à une potence de bois."""
    rows = rows_of("""
................
..bnnnnnnnN.....
..bnNNNNNNN.....
..bn....N.......
..bn....N.......
..bn...oYo......
..bn..oyiyo.....
..bn..yiwiY.....
..bn..yiiyY.....
..bn..oyyYo.....
..bn...ooo......
..bn............
..bn............
..bn............
.dbnNd..........
.ddGdd..........
""")
    return art(rows, outline=1)


def weathervane_rooster():
    """Girouette au coq (cuivre) sur un mât, flèche dessous."""
    rows = rows_of("""
...99...........
..9889.....9....
.98889....989...
9..9889...989...
...988899989....
...98888889.....
....9999999.....
.......9........
.0999999999998..
.......S........
....SS.S.SS.....
.......S........
.......S........
.......S........
......nNn.......
.....bnnnN......
""")
    return art(rows, outline=1)


def sign_magazine():
    """Panneau « Vu dans le magazine » : couverture encadrée (titre, photo de ferme), étoile dorée."""
    rows = rows_of("""
................
.BBBBBBBBBBBBB..
.BRRRRRRRRRRRB..
.BRwwRwRwwRRRB..
.BcccccccccccB..
.BccccccyYcccB..
.BcGGcccYYcccB..
.BGGGGGGcGGGGB..
.BGdGGnnnGGdGB..
.BGGGGnrnGGGGB..
.BBBBBBBBBBBBB..
.....n...n......
.....n...n......
.....n...n......
....dnd.dnd.....
................
""")
    im = art(rows, outline=1)
    return g2.mini_sparkle(im, 12, 2, big=False)


# Stands des fêtes de thème : auvent rayé à la couleur du thème, comptoir, marchandises
FAIR_GOODS = {   # (couleurs de l'auvent), marchandises 12 × 4 posées devant le fond du stand
    'bees': (('y', 'w'), ['wEw.wEw.wEw.', 'yiY.yiY.yiY.', 'yYY.yYY.yYY.', 'YYo.YYo.YYo.']),
    'cheese': (('i', 'w'), ['.iiiy..iiiy.', 'iyyyyYiyyyyY', 'iyyyyYiyyyyY', 'YYYYYoYYYYYo']),
    'tourism': (('C', 'w'), ['E...y...C...', 'E...i...C...', 'wwww.wwww.ww', 'wccw.wGGw.wc']),
    'giants': (('E', 'y'), ['....dN....C.', '.yyyYYyyYCwC', 'yiyYyYYyYYC.', 'YYYoYYoYYoC.']),
    'frogs': (('G', 'w'), ['.w.w...w.w..', '.GGG.P.GGG..', 'gGEGdPgGEGd.', 'ddddd.ddddd.']),
    'orchard': (('E', 'i'), ['rRrRr.gGgGg.', 'RqRRq.GdGGd.', 'bnbnb.bnbnb.', 'nbnbn.nbnbn.']),
    'bread': (('n', 'i'), ['.bbbb...bbb.', 'bkbkbb.bkkbb', 'bbbbbB.bbbbB', 'BBBBBB.BBBBB']),
    'markets': (('D', 'i'), ['RrR.GgG.yYy.', 'RRq.GGd.YYo.', 'nbn.nbn.nbn.', 'nnn.nnn.nnn.']),
    'lights': (('Q', 'y'), ['E...y...C...', 'E...i...C...', '.y..y..y..y.', '.w..w..w..w.']),
}


def fair_theme(tid):
    (c1, c2), goods = FAIR_GOODS[tid]
    g = Grid(16, 16)
    g.rect(2, 5, 13, 10, 'n')          # fond du stand (dans l'ombre de l'auvent)
    g.rect(2, 5, 13, 5, 'N')
    for x in range(1, 15):
        c = c1 if (x // 2) % 2 == 0 else c2
        for y in range(2, 5):
            g.set(x, y, c)
        if (x // 2) % 2 == 0:
            g.set(x, 5, c)
    g.rect(1, 1, 14, 1, 'N')
    for y, line in enumerate(goods):
        for x, ch in enumerate(line):
            if ch != '.':
                g.set(2 + x, 6 + y, ch)
    g.rect(1, 10, 14, 13, 'b')
    for x in range(1, 15):
        g.set(x, 10, 'k'); g.set(x, 13, 'B')
    for x in (2, 13):
        g.set(x, 14, 'n')
    return art(g.rows(), outline=1)


def scene_section():
    add('board.village', board_village())
    add('board.note', board_note('plain'))
    add('board.note.kept', board_note('kept'))
    add('board.note.done', board_note('done'))
    add('cart.market', cart_market(0))
    add('cart.market.1', cart_market(1))
    add('merchant.wagon', merchant_wagon(0))
    add('merchant.wagon.1', merchant_wagon(1))
    add('npc.merchant', basile('idle'))
    add('npc.merchant.walk', basile('walk'))
    for tid in FAIR_GOODS:
        add(f'fair.theme.{tid}', fair_theme(tid))
    add('lantern.peddler', lantern_peddler())
    add('weathervane.rooster', weathervane_rooster())
    add('sign.magazine', sign_magazine())


# ===========================================================================
# 3. Portraits 32 × 32 (tête et épaules, style de portrait.joseph de generate-career.py)
#
# Lettres propres aux portraits (remplacées par les couleurs de la peau du personnage) :
#   ( peau claire · ) peau ombrée · [ ombre du cou · ] yeux · { blanc de l'œil · } joues · ~ bouche
# Toutes les autres lettres sont celles de la palette.

SKINS = {  # (clair, ombre, cou, joues)
    'medium': ('f', 'F', 'n', 'r'),
    'fair': ('l', 'e', 'b', 'L'),
    'tan': ('b', 'B', 'n', 'R'),
    'dark': ('n', 'I', 'H', 'R'),
    'rosy': ('k', 'h', 'b', 'L'),
}


def portrait_pal(skin):
    l, s, k, ck = SKINS[skin]
    p = dict(PAL)
    p.update({'(': PAL[l], ')': PAL[s], '[': PAL[k], ']': PAL['Z'], '{': PAL['w'], '}': PAL[ck], '~': PAL['q']})
    return p


ellipse = Grid.cells_ellipse.__get__(Grid(1, 1))   # cellules d'une ellipse (fonction libre)


def p_torso(g, main, shade, cx=16, top=22, collar=None, v=False):
    """Épaules (chemise, veste…) : couleur `main`, ombre `shade` à droite ; col en V ou col clair."""
    for y in range(top, 32):
        k = min(1.0, (y - top) / 5)
        half = 7 + round(6 * k)
        for x in range(cx - half, cx + half):
            g.set(x, y, main if x < cx + half - 3 else shade)
    if collar:
        for (x, y) in ((cx - 4, top), (cx + 3, top), (cx - 3, top + 1), (cx + 2, top + 1), (cx - 4, top + 1),
                       (cx + 3, top + 1), (cx - 2, top + 2), (cx + 1, top + 2)):
            g.set(x, y, collar)
    if v:
        for i in range(4):
            for x in range(cx - 2 + i // 2, cx + 2 - i // 2):
                g.set(x, top + i, v)


def p_neck(g, cx=16):
    for y in range(19, 24):
        for x in range(cx - 3, cx + 3):
            g.set(x, y, '[' if y >= 21 else ')')


def p_face(g, expr='smile', cx=16, cheeks=True, ears=True, mouth=True):
    if ears:
        for (x, y) in ((cx - 9, 13), (cx - 9, 14), (cx - 9, 15), (cx + 8, 13), (cx + 8, 14), (cx + 8, 15)):
            g.set(x, y, '(' if x < cx else ')')
        g.set(cx - 8, 14, ')'); g.set(cx + 7, 14, ')')
    for (x, y) in ellipse(cx, 13.0, 8.2, 8.6):
        if 4 <= y <= 21:
            g.set(x, y, ')' if x >= cx + 5 or y >= 20 else '(')
    ey = 14
    if expr in ('smile', 'grin', 'calm'):
        for x0 in (cx - 5, cx + 2):
            g.rect(x0, ey, x0 + 1, ey + 1, ']')
            g.set(x0, ey, '{')
    elif expr in ('happy', 'laugh'):
        for x0 in (cx - 5, cx + 2):
            g.set(x0, ey, ']'); g.set(x0 + 1, ey - 1, ']'); g.set(x0 + 2, ey, ']')
    if cheeks:
        for (x, y) in ((cx - 6, 17), (cx - 5, 17), (cx + 4, 17), (cx + 5, 17)):
            g.set(x, y, '}')
    g.set(cx - 1, 16, ')'); g.set(cx, 16, ')')
    if not mouth:
        return
    if expr in ('grin', 'laugh'):
        g.rect(cx - 3, 18, cx + 2, 18, '~')
        g.rect(cx - 2, 18, cx + 1, 18, 'w')
        g.rect(cx - 2, 19, cx + 1, 19, '~')
    elif expr == 'calm':
        g.rect(cx - 2, 19, cx + 1, 19, '~')
    else:
        g.rect(cx - 2, 19, cx + 1, 19, '~')
        g.set(cx - 3, 18, '~'); g.set(cx + 2, 18, '~')


def p_hair_short(g, c1, c2, cx=16, low=10, part=False):
    for (x, y) in ellipse(cx, 10.5, 8.8, 7.2):
        if y <= 8 or (y <= low and (x <= cx - 6 or x >= cx + 5)):
            g.set(x, y, c1 if x < cx + 4 else c2)
    for x in (cx - 4, cx - 1, cx + 2):
        g.set(x, 9, c1); g.set(x + 1, 9, c2)
    if part:
        for y in range(4, 9):
            g.set(cx - 3, y, c2)


def p_hair_long_back(g, c1, c2, cx=16, bottom=25):
    for (x, y) in ellipse(cx, 14, 10.5, 11):
        if 4 <= y <= 20:
            g.set(x, y, c1 if x < cx + 5 else c2)
    for y in range(14, bottom):
        for x in list(range(cx - 10, cx - 6)) + list(range(cx + 6, cx + 10)):
            if y < bottom - 1 or x in (cx - 9, cx - 8, cx + 7, cx + 8):
                g.set(x, y, c1 if x < cx else c2)


def p_fringe(g, c1, c2, cx=16):
    for (x, y) in ellipse(cx, 10.5, 8.8, 7.2):
        if y <= 8:
            g.set(x, y, c1 if x < cx + 4 else c2)
    for x in range(cx - 7, cx + 7):
        g.set(x, 9, c1 if (x + 1) % 4 else c2)
    for (x, y) in ((cx - 8, 10), (cx - 8, 11), (cx - 8, 12), (cx + 7, 10), (cx + 7, 11), (cx + 7, 12)):
        g.set(x, y, c1 if x < cx else c2)


def p_brim_hat(g, c1, c2, band, cx=16, crown_top=1, brim_y=9.5, brim_rx=15, brim_ry=3.2):
    for (x, y) in ellipse(cx, brim_y, brim_rx, brim_ry):
        g.set(x, y, c1 if y <= brim_y else c2)
    for y in range(crown_top, int(brim_y)):
        for x in range(cx - 7, cx + 7):
            if y == crown_top and x in (cx - 7, cx + 6):
                continue
            g.set(x, y, c2 if x >= cx + 4 else c1)
    for x in range(cx - 7, cx + 7):
        g.set(x, int(brim_y) - 3, band); g.set(x, int(brim_y) - 2, band)


def p_cap(g, c1, c2, visor, cx=16, band=None):
    for (x, y) in ellipse(cx, 8.5, 9.5, 5.5):
        if y <= 9:
            g.set(x, y, c1 if x < cx + 5 else c2)
    for x in range(cx - 9, cx + 11):
        g.set(x, 10, visor)
    for x in range(cx - 7, cx + 11):
        g.set(x, 11, visor)
    if band:
        for x in range(cx - 9, cx + 10):
            if g.get(x, 9) not in '.':
                g.set(x, 9, band)


def p_glasses(g, frame='N', cx=16):
    """Lunettes : deux verres de 4 × 2 (l'œil et un peu de peau dedans), pont et branches."""
    for x0 in (cx - 7, cx + 1):
        g.rect(x0 + 1, 13, x0 + 4, 13, frame)
        g.rect(x0 + 1, 16, x0 + 4, 16, frame)
        for y in (14, 15):
            g.set(x0, y, frame); g.set(x0 + 5, y, frame)
    g.set(cx - 1, 14, frame); g.set(cx, 14, frame)
    g.set(cx - 8, 14, frame); g.set(cx + 7, 14, frame)


def p_moustache(g, c, cx=16, wide=False):
    for x in range(cx - 4 - wide, cx + 4 + wide):
        g.set(x, 17, c)
    g.set(cx - 4 - wide, 18, c); g.set(cx + 3 + wide, 18, c)
    g.set(cx - 1, 17, c); g.set(cx, 17, c)


def p_beard(g, c1, c2, cx=16, big=False):
    ry = 5.6 if big else 4.2
    cy = 20.5 if big else 19.5
    for (x, y) in ellipse(cx, cy, 7.4 if big else 7.0, ry):
        if y >= 17:
            g.set(x, y, c1 if x < cx + 4 else c2)
    for x in range(cx - 5, cx + 5):
        g.set(x, 17, c1 if x < cx + 3 else c2)
    g.set(cx - 6, 18, c1); g.set(cx + 5, 18, c2)


def portrait(draw, skin):
    g = Grid(32, 32)
    draw(g)
    return art(g.rows(), w=32, h=32, pal=portrait_pal(skin))


# --- Les 12 clients du tableau ---------------------------------------------------------------

def pt_rose(g):
    """Mme Rose, la fleuriste : carré auburn, chapeau cloche de paille à grosse fleur, tablier vert."""
    p_hair_long_back(g, 'R', 'q', bottom=22)
    p_torso(g, 'L', 'O', collar='w')
    for y in range(25, 32):                 # tablier vert à bretelles
        g.set(10, y, 'G'); g.set(11, y, 'G'); g.set(20, y, 'G'); g.set(21, y, 'G')
    g.rect(10, 28, 21, 31, 'G'); g.rect(18, 28, 21, 31, 'd')
    g.set(13, 30, 'g'); g.set(14, 29, 'g')
    p_neck(g)
    p_face(g, 'smile')
    p_fringe(g, 'R', 'q')
    p_brim_hat(g, 'k', 'b', 'G', crown_top=2, brim_y=8.5, brim_rx=13, brim_ry=2.6)
    g.stamp(['.pp.', 'pwwp', 'pwyp', '.pp.'], 6, 3)       # grosse fleur rose sur le chapeau
    g.stamp(['.p.', 'pyp', '.p.'], 9, 6)
    g.stamp(['gG', 'Gd'], 4, 6)


def pt_paulo(g):
    """Paulo, le boulanger : toque blanche, moustache noire, joues enfarinées, veste blanche."""
    p_torso(g, 'W', 's', collar='w')
    for y in (25, 28):
        g.set(13, y, 'S'); g.set(18, y, 'S')
    p_neck(g)
    p_face(g, 'grin')
    p_hair_short(g, 'z', 'Z')
    p_moustache(g, 'Z', wide=True)
    for y in range(0, 8):                    # toque
        for x in range(8, 24):
            if (y == 0 and x in (8, 9, 22, 23)) or (y == 1 and x in (8, 23)):
                continue
            g.set(x, y, 'w' if x < 18 else 'W' if x < 21 else 's')
    for x in (11, 15, 19):
        g.set(x, 2, 's'); g.set(x, 3, 's')
    g.rect(9, 7, 22, 9, 'W')
    g.rect(19, 7, 22, 9, 's')
    for (x, y) in ((10, 18), (9, 17), (21, 16), (22, 18), (12, 20)):   # farine
        g.set(x, y, 'w')


def pt_lili(g):
    """La petite Lili : couettes blondes à rubans rouges, robe bleue, son lapin blanc Caramel."""
    p_hair_short(g, 'y', 'Y', low=12)
    for side, xs in ((-1, (3, 4, 5, 6)), (1, (25, 26, 27, 28))):     # couettes
        for (x, y) in ellipse(xs[0] + 2, 15, 2.6, 4.4):
            g.set(x, y, 'y' if side < 0 else 'Y')
        g.stamp(['EE', 'qE'], xs[1], 9)
    p_torso(g, 'C', 'u', collar='w')
    p_neck(g)
    p_face(g, 'grin')
    p_fringe(g, 'y', 'Y')
    g.stamp(['EE.', 'EqE', '.E.'], 9, 5)         # petit nœud
    # lapin dans les bras (en bas à gauche)
    for (x, y) in ellipse(8.5, 27.5, 5.2, 4.2):
        g.set(x, y, 'w' if x < 10 else 'W')
    g.stamp(['wW.wW', 'wK.wK', 'wK.wK'], 5, 18)
    g.set(6, 26, ']'); g.set(10, 26, ']')
    g.set(8, 28, 'K')


def pt_garnier(g):
    """M. Garnier, l'instituteur : raie sur le côté, lunettes, moustache, veste de tweed et cravate."""
    p_torso(g, 'n', 'N', collar='w')
    g.rect(15, 23, 16, 31, 'R'); g.set(15, 23, 'q'); g.set(16, 23, 'q')
    for (x, y) in ((11, 26), (20, 27), (12, 30), (21, 30)):
        g.set(x, y, 'b')
    p_neck(g)
    p_face(g, 'smile')
    p_hair_short(g, 'n', 'N', part=True)
    p_glasses(g, 'Z')
    for x0 in (10, 18):
        g.set(x0, 14, '(') if g.get(x0, 14) == '{' else None
    p_moustache(g, 'N')


def pt_chevalier(g):
    """Mme Chevalier, l'aubergiste : chignon brun et foulard rouge, robe bleue, tablier blanc."""
    p_torso(g, 'x', 'z', collar='w')
    g.rect(10, 26, 21, 31, 'W'); g.rect(18, 26, 21, 31, 's')
    for y in range(22, 26):
        g.set(10, y, 'W'); g.set(21, y, 's')
    p_neck(g)
    p_face(g, 'grin')
    for (x, y) in ellipse(16, 4.5, 4.4, 3.4):    # chignon
        g.set(x, y, 'N' if x < 18 else 'H')
    p_fringe(g, 'N', 'H')
    for x in range(8, 24):                        # foulard
        g.set(x, 6, 'E'); g.set(x, 7, 'R' if x % 3 else 'w')
    g.stamp(['EE', 'qE', '.q'], 23, 7)


def pt_fabre(g):
    """Le père Fabre, pêcheur : casquette bleu marine, barbe grise courte, ciré jaune."""
    p_torso(g, 'y', 'Y', collar='i')
    g.rect(15, 24, 16, 31, 'o')
    p_neck(g)
    p_face(g, 'calm')
    p_beard(g, 's', 'S')
    g.rect(14, 19, 17, 19, '~')
    for (x, y) in ((7, 10), (7, 11), (7, 12), (24, 10), (24, 11), (24, 12)):
        g.set(x, y, 's')
    p_cap(g, 'x', 'z', 'Z')
    g.set(10, 6, 'M'); g.set(11, 5, 'M')
    for x in (11, 12, 19, 20):                     # sourcils gris
        g.set(x, 12, 's')


def pt_perrin(g):
    """Mlle Perrin, la musicienne : longs cheveux noirs, robe violette, violon sur l'épaule."""
    p_hair_long_back(g, 'z', 'Z', bottom=27)
    p_torso(g, 'Q', 'a', collar='P')
    p_neck(g)
    p_face(g, 'happy')
    p_fringe(g, 'z', 'Z')
    g.stamp(['.P.', 'PwP', '.P.'], 21, 7)         # fleur dans les cheveux
    # violon (posé sur l'épaule gauche à l'écran) et archet
    for (x, y) in ellipse(7.5, 27.5, 4.2, 4.6):
        g.set(x, y, 'Y' if x < 8 else 'o')
    for (x, y) in ellipse(9.0, 23.5, 3.0, 2.6):
        g.set(x, y, 'Y' if x < 9 else 'o')
    g.set(6, 27, 'A'); g.set(9, 27, 'A')
    g.line(8, 21, 8, 31, 'N')
    g.line(2, 31, 14, 19, 'k')


def pt_maire(g):
    """M. le maire : dégarni aux tempes grises, grosse moustache, costume sombre, écharpe tricolore."""
    p_torso(g, 'z', 'Z', collar='w')
    g.rect(15, 23, 16, 26, 'w')
    for i in range(12):                            # écharpe tricolore en diagonale
        x, y = 9 + i, 21 + i
        g.set(x, y, 't'); g.set(x + 1, y, 'w'); g.set(x + 2, y, 'E')
        g.set(x - 1, y, 't')
    p_neck(g)
    p_face(g, 'smile', mouth=False)
    for (x, y) in ((7, 10), (7, 11), (7, 12), (8, 9), (8, 10), (24, 10), (24, 11), (24, 12), (23, 9), (23, 10)):
        g.set(x, y, 'W' if x < 16 else 's')
    for (x, y) in ellipse(16, 6.0, 6.0, 2.2):     # crâne luisant
        if y <= 5:
            g.set(x, y, '(')
    g.set(13, 5, 'w'); g.set(14, 5, 'w')
    p_moustache(g, 'W', wide=True)
    g.set(15, 19, '~'); g.set(16, 19, '~')


def pt_odette(g):
    """Mamie Odette : chignon blanc, lunettes rondes au bout du nez, châle rose, gilet lavande."""
    p_torso(g, 'P', 'Q', collar='w')
    for i in range(6):                             # châle croisé
        g.set(10 + i, 22 + i, 'L'); g.set(21 - i, 22 + i, 'L')
        g.set(9 + i, 22 + i, 'O'); g.set(22 - i, 22 + i, 'O')
    p_neck(g)
    p_face(g, 'happy')
    for (x, y) in ellipse(16, 3.8, 4.6, 3.4):
        g.set(x, y, 'w' if x < 18 else 's')
    g.set(16, 1, 'E')                              # épingle
    p_fringe(g, 'W', 's')
    p_glasses(g, 'o')
    for (x, y) in ((10, 19), (21, 19)):            # rides
        g.set(x, y, ')')


def pt_leon(g):
    """Léon, le facteur : képi bleu à bandeau jaune, uniforme bleu, sangle de sacoche en cuir."""
    p_torso(g, 'C', 'u', collar='c')
    for i in range(11):
        x, y = 21 - i, 21 + i
        g.set(x, y, 'n'); g.set(x + 1, y, 'N')
    g.stamp(['nnn', 'nyn'], 14, 25)
    for (x, y) in ((11, 27), (11, 30), (20, 29)):
        g.set(x, y, 'y')
    p_neck(g)
    p_face(g, 'grin')
    p_hair_short(g, 'n', 'N')
    for y in range(2, 9):                          # képi
        for x in range(8, 24):
            g.set(x, y, 'C' if x < 20 else 'u')
    g.rect(8, 6, 23, 7, 'y')
    g.rect(7, 9, 24, 9, 'z'); g.rect(9, 10, 22, 10, 'z')
    g.stamp(['.y.', 'yiy', '.y.'], 15, 3)


def pt_morel(g):
    """Mme Morel, la couturière : chignon roux piqué d'une aiguille, mètre ruban autour du cou."""
    p_torso(g, 'v', 'c', collar='w')
    p_neck(g)
    p_face(g, 'smile')
    for (x, y) in ellipse(22.5, 5.0, 4.4, 3.6):
        g.set(x, y, 'Y' if x < 24 else 'o')
    p_fringe(g, 'Y', 'o')
    g.line(24, 1, 20, 7, 's'); g.set(24, 1, 'E')
    # mètre ruban jaune qui pend des deux côtés du cou
    for y in range(21, 32):
        g.set(11, y, 'y'); g.set(12, y, 'y' if y % 2 else 'Z')
        g.set(19, y, 'y' if y % 2 else 'Z'); g.set(20, y, 'y')
    for x in range(11, 21):
        if g.get(x, 21) in '[)':
            g.set(x, 21, 'y')
    p_glasses(g, 'Q') if False else None


def small_face(g, cx, cy, skin_rx=5.6, skin_ry=6.0, expr='grin'):
    for (x, y) in ellipse(cx, cy, skin_rx, skin_ry):
        g.set(x, y, ')' if x >= cx + 3 or y >= cy + 4 else '(')
    g.set(cx - 6, cy, '('); g.set(cx + 5, cy, ')')
    ey = cy
    for x0 in (cx - 3, cx + 2):
        g.set(x0, ey, ']'); g.set(x0, ey + 1, ']')
    g.set(cx - 5, ey + 2, '}'); g.set(cx + 4, ey + 2, '}')
    g.rect(cx - 1, ey + 3, cx, ey + 3, '~')
    if expr == 'grin':
        g.set(cx - 2, ey + 3, '~'); g.set(cx + 1, ey + 3, '~')


def pt_twins(g):
    """Zoé et Bastien, les jumeaux, côte à côte : elle à couettes rousses, lui à casquette verte."""
    # Zoé (à gauche)
    for (x, y) in ellipse(8, 13.5, 7.0, 7.4):
        if y <= 18:
            g.set(x, y, 'R' if x < 11 else 'q')
    g.stamp(['RR', 'RR', 'Rq', 'qq'], 0, 14)
    g.stamp(['qq', 'Rq', 'qq', 'q.'], 14, 14)
    for y in range(22, 32):
        half = 5 + min(3, (y - 22) // 2)
        for x in range(8 - half, 8 + half):
            g.set(x, y, 'p' if x < 8 + half - 2 else 'E')
    g.rect(6, 20, 9, 22, ')')
    small_face(g, 8, 15)
    for x in range(3, 13):
        g.set(x, 9, 'R' if x % 3 else 'q')
    g.stamp(['yy', 'Yy'], 1, 10)
    # Bastien (à droite)
    for y in range(22, 32):
        half = 5 + min(3, (y - 22) // 2)
        for x in range(24 - half, 24 + half):
            g.set(x, y, 'G' if x < 24 + half - 2 else 'd')
    g.rect(22, 20, 25, 22, ')')
    for (x, y) in ellipse(24, 13.0, 6.4, 6.6):
        if y <= 12:
            g.set(x, y, 'R' if x < 27 else 'q')
    small_face(g, 24, 15)
    for (x, y) in ellipse(24, 10.0, 6.6, 4.0):
        if y <= 10:
            g.set(x, y, 'G' if x < 27 else 'd')
    for x in range(24, 32):
        g.set(x, 11, 'D')
    g.stamp(['wy', 'yw'], 22, 7)


# --- Basile le colporteur --------------------------------------------------------------------

def pt_merchant(g):
    """Basile : grand chapeau violet à plume rouge, barbe brune bien taillée, foulard rouge, gilet vert."""
    p_torso(g, 'i', 'y', collar='w')
    for y in range(23, 32):                        # gilet vert ouvert
        for x in range(4, 14):
            if g.get(x, y) not in '.' and x < 14 - (y - 23) // 3:
                g.set(x, y, 'J')
        for x in range(18, 28):
            if g.get(x, y) not in '.' and x > 17 + (y - 23) // 3:
                g.set(x, y, 'd')
    g.set(12, 27, 'y'); g.set(12, 30, 'y')
    g.line(2, 26, 6, 22, 'n'); g.line(29, 26, 25, 22, 'n')   # bretelles du sac à dos
    p_neck(g)
    g.stamp(['EEEEEEE', '.EqEEq.', '..EEq..', '...q...'], 13, 21)  # foulard
    p_face(g, 'happy')
    p_hair_short(g, 'N', 'H')
    p_beard(g, 'N', 'H')
    g.rect(14, 18, 17, 18, '~'); g.rect(14, 19, 17, 19, 'w'); g.set(13, 18, '~'); g.set(18, 18, '~')
    p_moustache(g, 'H')
    p_brim_hat(g, 'Q', 'a', 'y', crown_top=0, brim_y=8.5, brim_rx=15.5, brim_ry=3.0)
    # plume rouge piquée dans le ruban
    g.line(22, 6, 29, 0, 'p')
    g.line(23, 6, 30, 1, 'E')
    g.line(22, 5, 28, 0, 'q')


# --- Visiteurs uniques des années à thème -----------------------------------------------------

def pt_margot(g):
    """Margot l'apicultrice : chapeau à large bord et voile de tulle, combinaison blanche, une abeille."""
    p_torso(g, 'W', 's', collar='w')
    g.stamp(['yy', 'YY'], 13, 26)
    p_neck(g)
    p_face(g, 'smile')
    p_hair_short(g, 'y', 'Y')
    p_brim_hat(g, 'k', 'b', 'k', crown_top=1, brim_y=8.5, brim_rx=15.5, brim_ry=2.6)
    # voile : tulle clair qui tombe du bord du chapeau (une maille sur deux)
    for y in range(11, 24):
        for x in range(4, 28):
            if g.get(x, y) == '.' and (x + y) % 2 == 0 and abs(x - 15.5) <= 11 - max(0, y - 18):
                g.set(x, y, 's')
    for x in range(5, 27):
        if (x + 12) % 2 == 0 and g.get(x, 12) in '()[':
            pass
    # abeille
    g.stamp(['.ww.', 'yZyZ', '.yZ.'], 25, 15)


def pt_anselme(g):
    """Anselme le fromager : béret noir, moustache, marinière, une pointe de fromage."""
    p_torso(g, 'w', 'W', collar=None)
    for y in range(23, 32, 2):
        for x in range(0, 32):
            if g.get(x, y) not in '.':
                g.set(x, y, 't')
    p_neck(g)
    p_face(g, 'grin')
    p_hair_short(g, 'N', 'H')
    p_moustache(g, 'N', wide=True)
    for (x, y) in ellipse(15, 5.5, 9.0, 3.6):     # béret
        g.set(x, y, '&' if x < 19 else 'Z')
    g.set(15, 1, '&'); g.set(15, 2, '&')
    g.rect(7, 8, 23, 8, 'Z')
    # pointe de fromage tenue en bas à droite
    g.stamp(['....yi', '..yyyi', 'yyyiyi', 'yYyyyY', 'YYYYYo'], 22, 26)


def pt_journalist(g):
    """La journaliste de « Campagne & Jardins » : carré noir, veste verte, appareil photo au cou."""
    p_hair_long_back(g, 'z', 'Z', bottom=21)
    p_torso(g, 'D', 'd', collar='w')
    p_neck(g)
    p_face(g, 'grin')
    p_fringe(g, 'z', 'Z')
    g.rect(21, 6, 23, 7, 'E')                      # barrette
    g.line(11, 21, 13, 26, '&'); g.line(20, 21, 18, 26, '&')
    g.rect(10, 25, 21, 31, '&'); g.rect(10, 25, 21, 25, '+')
    g.rect(11, 24, 13, 24, '+')
    for (x, y) in ellipse(16, 28.5, 3.2, 3.0):
        g.set(x, y, 'x')
    for (x, y) in ellipse(16, 28.5, 1.8, 1.6):
        g.set(x, y, 'c')
    g.set(15, 27, 'w'); g.set(19, 26, 'E')


def pt_gaspard(g):
    """Gaspard, jardinier champion : chapeau de paille, barbe rousse, salopette verte, médaille d'or."""
    p_torso(g, 'w', 'W', collar=None)
    for y in range(24, 32):
        g.set(10, y, 'G'); g.set(11, y, 'G'); g.set(20, y, 'd'); g.set(21, y, 'd')
    g.rect(10, 27, 21, 31, 'G'); g.rect(18, 27, 21, 31, 'd')
    p_neck(g)
    p_face(g, 'grin')
    p_beard(g, 'Y', 'o')
    g.rect(14, 18, 17, 18, '~'); g.rect(14, 19, 17, 19, 'w')
    p_brim_hat(g, 'k', 'b', 'E', crown_top=2, brim_y=9.5)
    # médaille d'or sur ruban bleu-blanc-rouge
    g.stamp(['tE', 'tE'], 15, 22)
    g.stamp(['.yy.', 'yiyY', 'yyYo', '.oo.'], 14, 24)


def pt_firmin(g):
    """Firmin, le vieux pêcheur barbu : chapeau de pluie jaune (suroît), grande barbe blanche."""
    p_torso(g, 'y', 'Y', collar=None)
    p_neck(g)
    p_face(g, 'happy', mouth=False)
    p_beard(g, 'w', 's', big=True)
    p_moustache(g, 'W', wide=True)
    for x in (11, 12, 19, 20):
        g.set(x, 12, 'W')
    for (x, y) in ellipse(16, 7.0, 8.6, 5.0):      # suroît
        if y <= 8:
            g.set(x, y, 'y' if x < 20 else 'Y')
    for (x, y) in ellipse(16, 10.0, 13.0, 2.4):
        if y >= 9:
            g.set(x, y, 'Y' if y == 9 else 'o')
    for x in range(4, 29):
        if g.get(x, 9) not in '.':
            g.set(x, 9, 'Y')
    g.set(12, 4, 'i'); g.set(13, 3, 'i')


def pt_mathis(g):
    """Mathis le pépiniériste : cheveux bouclés, tablier vert, un jeune plant en pot dans les mains."""
    p_torso(g, 'r', 'R', collar='w')
    g.rect(9, 24, 22, 31, 'J'); g.rect(19, 24, 22, 31, 'd')
    p_neck(g)
    p_face(g, 'smile')
    for (x, y) in ellipse(16, 9.5, 10.0, 8.0):     # boucles serrées
        if y <= 8 or (y <= 12 and (x <= 9 or x >= 22)):
            g.set(x, y, 'H' if (x // 2 + y // 2) % 2 else 'N')
            if (x % 2 == 0 and y % 2 == 0) and x < 21:
                g.set(x, y, 'n')
    # plant en pot
    g.stamp(['..gG..', '.gGGd.', 'gGdGGd', '.dGd..', '..N...'], 13, 21)
    g.stamp(['RRRRRR', 'rRRRRq', '.RRRq.', '.qqqq.'], 13, 26)


def pt_jeanne(g):
    """Jeanne la meunière : foulard blanc noué, natte blonde, robe beige, farine sur la joue."""
    p_torso(g, 'c', 'C', collar='w')
    g.rect(10, 26, 21, 31, 'W'); g.rect(18, 26, 21, 31, 's')
    p_neck(g)
    p_face(g, 'grin')
    p_fringe(g, 'y', 'Y')
    for (x, y) in ellipse(16, 7.5, 9.4, 6.0):     # foulard
        if y <= 8:
            g.set(x, y, 'w' if x < 20 else 'W')
    for x in range(7, 25):
        g.set(x, 9, 'W' if x % 4 else 's')
    g.stamp(['wW', 'Ws', '.s'], 24, 9)
    for y in range(13, 26):                        # natte sur l'épaule
        g.set(24, y, 'y' if y % 2 else 'Y'); g.set(25, y, 'Y')
    g.stamp(['EE', 'qE'], 24, 26)
    for (x, y) in ((10, 18), (11, 19), (21, 17), (19, 27), (13, 29)):
        g.set(x, y, 'w')


def pt_wholesaler(g):
    """Le grossiste de la ville : chapeau melon, favoris, gilet gris, chaîne de montre dorée."""
    p_torso(g, 'S', 'M', collar='w')
    g.rect(15, 23, 16, 25, 'q')
    g.rect(11, 25, 20, 31, 'x')
    g.line(12, 28, 16, 29, 'y'); g.line(16, 29, 19, 27, 'y')
    g.set(19, 28, 'i')
    p_neck(g)
    p_face(g, 'smile')
    for (x, y) in ((7, 11), (7, 12), (7, 13), (8, 14), (8, 15), (8, 16), (24, 11), (24, 12), (24, 13), (23, 14),
                   (23, 15), (23, 16), (8, 13), (23, 13)):
        g.set(x, y, 'N')
    p_moustache(g, 'N')
    for (x, y) in ellipse(16, 7.0, 7.0, 6.0):       # chapeau melon
        if y <= 8:
            g.set(x, y, '&' if x < 19 else 'Z')
    g.set(12, 3, '+'); g.set(13, 2, '+')
    g.rect(5, 9, 26, 9, '&'); g.rect(6, 10, 25, 10, 'Z')
    g.rect(9, 8, 22, 8, 'q')


def pt_northpeddler(g):
    """Le colporteur du Nord : chapka de fourrure, barbe givrée, manteau à col de fourrure."""
    p_torso(g, 'R', 'q', collar=None)
    for (x, y) in ellipse(16, 24.5, 10.5, 3.2):
        g.set(x, y, '%' if x < 22 else '#')
    for y in range(26, 32):
        g.set(16, y, '%')
    for (x, y) in ((14, 28), (14, 31)):
        g.set(x, y, 'y')
    p_neck(g)
    p_face(g, 'happy', mouth=False)
    p_beard(g, 's', 'S', big=True)
    p_moustache(g, 'W', wide=True)
    g.set(9, 16, 'L'); g.set(10, 16, 'L'); g.set(21, 16, 'L'); g.set(22, 16, 'L')
    for (x, y) in ellipse(16, 6.5, 9.6, 6.0):       # chapka
        if y <= 9:
            g.set(x, y, '%' if x < 21 else '#')
    for x in range(6, 26):
        g.set(x, 9, '#' if x % 3 else '%')
        g.set(x, 10, '%' if x % 2 else '#')
    for y in range(10, 17):                          # rabats sur les oreilles
        for x in (5, 6, 7, 24, 25, 26):
            g.set(x, y, '%' if x < 16 else '#')
    g.stamp(['.y.', 'yiy', '.y.'], 15, 3)


CLIENT_PORTRAITS = {
    'rose': (pt_rose, 'fair'), 'paulo': (pt_paulo, 'tan'), 'lili': (pt_lili, 'rosy'),
    'garnier': (pt_garnier, 'medium'), 'chevalier': (pt_chevalier, 'dark'), 'fabre': (pt_fabre, 'tan'),
    'perrin': (pt_perrin, 'medium'), 'maire': (pt_maire, 'fair'), 'odette': (pt_odette, 'rosy'),
    'leon': (pt_leon, 'dark'), 'morel': (pt_morel, 'fair'), 'twins': (pt_twins, 'medium'),
}
THEME_PORTRAITS = {
    'margot': (pt_margot, 'fair'), 'anselme': (pt_anselme, 'rosy'), 'journalist': (pt_journalist, 'tan'),
    'gaspard': (pt_gaspard, 'fair'), 'firmin': (pt_firmin, 'medium'), 'mathis': (pt_mathis, 'dark'),
    'jeanne': (pt_jeanne, 'rosy'), 'wholesaler': (pt_wholesaler, 'medium'), 'northpeddler': (pt_northpeddler, 'rosy'),
}


def portrait_section():
    for cid, (fn, skin) in CLIENT_PORTRAITS.items():
        add(f'portrait.client.{cid}', portrait(fn, skin))
    add('portrait.merchant', portrait(pt_merchant, 'medium'))
    for tid, (fn, skin) in THEME_PORTRAITS.items():
        add(f'portrait.theme.{tid}', portrait(fn, skin))


# ===========================================================================
# 4. Icônes 16 × 16 (contour fin, comme assets/sprites/ui/icons.png)

COIN = ['.yyy.', 'yiyyY', 'yyiyY', 'yyyYo', '.YYo.']


def stamp_icon(base_src, stamps):
    """Icône ASCII + petits tampons (motif, x, y) posés par-dessus avant le contour."""
    g = Grid(16, 16)
    if base_src:
        g.stamp(rows_of(base_src), 0, 0)
    for (pat, x, y) in stamps:
        g.stamp(pat, x, y)
    return art(g.rows(), outline=1, w=16, h=16)


TAB_ICONS = {
    'board': """
................
...qqqqqqqqqq...
..qRRrRRrRRrRq..
.qqqqqqqqqqqqqq.
..nBBBBBBBBBBn..
..nBwwwBBwwwBn..
..nBwSwBBwSwBn..
..nBwwwBBwwwBn..
..nBwSwBBwwwBn..
..nBwwwBBwSwBn..
..nBBBBBBBBBBn..
..nN........nN..
..nN........nN..
.dnNd......dnNd.
""",
    'cart': """
................
.....dG..y......
....gGGdyYYo....
...gGGGdyYYo....
.nnnnnnnnnnnn...
.nBbBBbBBbBBn...
.nBbBBbBBbBBnnnn
.nnnnnnnnnnnn...
...NNN....NNN...
..NbYbN..NbYbN..
..NYYYN..NYYYN..
..NbYbN..NbYbN..
...NNN....NNN...
""",
    'cards': """
................
..CCCCCCC.......
..CwCwCwC.......
..CCwCwCC.......
..CwCwCwiiiiiiii
..CCwCwCiwwwwwwi
..CwCwCwiwwEwwwi
..CCwCwCiwEEEwwi
..CwCwCwiwwEwwwi
..CCwCwCiwwwwwwi
..CCCCCCiwwwwywi
........iwwwyiyi
........iwwwwyii
........iiiiiiii
""",
    'challenge': """
................
..n.............
..nEEEEEEEE.....
..nEEEEwEEEE....
..nEEEwwwEEEE...
..nEEEEwEEEE....
..nEEEwEwEE.....
..nqqqqqqq......
..n.............
..n.............
..n.............
..n.............
.bnN............
.dddd...........
""",
    'merchant': """
.............pq.
............pq..
...........pq...
.....QQQQQpq....
....QQQQQQQQ....
....QQQQQQaa....
....yyyyyyyy....
....QQQQQQaa....
.QQQQQQQQQQQQQa.
QaaaaaaaaaaaaaaQ
.QQQQQQQQQQQQQQ.
................
""",
    'theme': """
................
.N..............
.NnN..........N.
.N.nNNNN...NnnN.
.N.E...nnNnn..N.
.N.EE..y....C.N.
.N.EEE.yy..CC.N.
.N.EE..yyy.CCCN.
.N.E...yy...C.N.
.N.....y......N.
.N............N.
.N............N.
.N............N.
dNd..........dNd
""",
    'rare': """
.......i........
.......y........
.....iiwii...i..
.......y....iwi.
.......i.....i..
....yyyy........
...yiiyyY.......
..yiwyyyYo......
..yiyyyYYo......
..yyyyYYoo......
...yYYYoo.......
....oooo...i....
..........iwi...
...........i....
""",
}

CARD_ICONS = {
    'purse': ("""
................
......N...N.....
.....NyN.NyN....
......NNNNN.....
.....nbbbbbn....
....nbkbbbbbn...
...nbkbbbbbbBn..
...nbbbbbbbbBn..
..nbbbbbbbbbBBn.
..nbbbbbbbbbBBn.
..nBbbbbbbbBBBn.
...nBBBBBBBBBn..
....nnnnnnnnn...
""", [(COIN, 10, 9)]),
    'seedFair': ("""
................
..lllllllll.....
..lkkkkkkkl.....
..lkkkGkkkl.....
..lkkGgdkkl.....
..lkkkdkkkl.....
..lkkkdkkkl.....
..lkkkkkkkl.....
..lkbkbkbkl.....
..lllllllll.....
""", [(['..EEEEE..', '.EEEEEEE.', 'EEwwEEwEE', 'EEwwEwEEq', 'EEEEwEEEq', 'EEEwEwwEq', 'EEwEEwwEq', '.EEEEEEq.', '..qqqqq..'], 7, 6)]),
    'fertilizer': ("""
................
.....nNNNNn.....
......bkkb......
.....bkkkkb.....
....bkkkkkkB....
...bkkkkkkkBB...
...bkkkGgkkBB...
...bkkGGgGkBB...
...bkkkGdkkBB...
...bkkkkdkkBB...
...bkkkkkkBBB...
...BbbbbbbbBB...
....BBBBBBBB....
""", [(['..GG', '.Gg.', 'Gd..'], 11, 1)]),
    'watering': ("""
................
.......SSSS.....
......S....S....
......S....S....
..s...sssssssS..
.sWs.sWWsssssSS.
..sssWssssssssSS
...sWsssssssssS.
....sssssssssSS.
....ssssssssSSS.
....ssssssssSS..
....SSSSSSSSSS..
""", [(['...y...', '..yiy..', 'yyiwiyy', '.yyiyy.', '.yY.Yy.'], 6, 6)]),
    'poster': ("""
................
.......S........
...wwwwMwwwww...
...wEEEEEEEEw...
...wEEwwwwEEw...
...wwwwwwwwww...
...wSSSSSSSSw...
...wwwwwwwwww...
...wcccccyccw...
...wcccccccc.w..
...wGGGGGGGGw...
...wGdGGGGdGw...
...wwwwwwwwww...
....ssssssssss..
""", []),
    'landlord': ("""
................
...yyy..........
..yiwyy.........
..yy.yy.........
..yyyyy.........
...yyY..........
....yY..........
....yY..........
....yYY.........
....yY..........
....yYY.........
....yY..........
.....Y..........
""", [(['..yyyy..', '.yiiyyY.', 'yiyyyyYo', 'yiyYYyYo', 'yyyYYyYo', 'yyyyyYYo', '.YYYYoo.', '..oooo..'], 7, 7)]),
    'bees': ("""
................
................
........ww......
.......wcw......
.......yZyZ.....
......yyZyZy....
.......yZyZ.....
................
..ww........ww..
.wcw.......wcw..
.yZyZ......yZyZ.
yyZyZy....yyZyZy
.yZyZ......yZyZ.
................
""", []),
    'crier': ("""
.......nn.......
.......nN.......
.......nN.......
......yyyY......
.....yiyyYY.....
.....yiyyYY.....
....yiyyyyYY....
....yiyyyyYY....
...yiyyyyyyYY...
..yyyyyyyyyyYo..
..YYYYYYYYYYoo..
.......oo.......
................
""", [(['w..', '.w.', 'w..'], 0, 3), (['..w', '.w.', '..w'], 13, 3)]),
    'cartHorse': ("""
.....NN.........
....NnN.N.......
....NnnNnN......
...NnnnnnHH.....
..NnAnnnnnHH....
.NnnnnnnnnnHH...
NbbnnnnnnnnnHH..
NbbbnnnnnnnnnH..
.NbNNnnnnnnnnH..
..NN.Nnnnnnnn...
.....Nnnnnnnn...
""", [(['.SSSSS.', 'SsS.SsS', 'Ss...sS', 'SS...SS'], 8, 10)]),
    'clearing': ("""
............S...
...........SsS..
..........SsS...
.........nS.....
........nN......
.......nN.......
......nN........
.....nN.........
...ssN..........
..sWsS..........
..ssSS..........
..sSS...........
................
""", [(['..bkkb..', '.bkbbkb.', 'bnbkkbnb', 'bnnbbnnb', 'nnnnnnnN', 'dn.nN.nd'], 8, 9)]),
    'recipe': ("""
................
..EEEEEEEEEE....
..EwwwwwwwwqE...
..EwssssssqqE...
..EwwwwwwwqqE...
..EwssssswqqE...
..EwwwwwwwqqE...
..EwsssswwqqE...
..EwwwwwwwqqE...
..EqqqqqqqqqE...
..EEEEEEEEEEE...
""", [(['.ss', 'sWs', 'sss', '.S.', '.S.', '.S.'], 11, 6)]),
    'almanac': ("""
................
...CCCCCCCCCC...
...CwwwwwwwwuC..
...CwccccccwuC..
...Cwc..yy.wuC..
...Cwc.yiyywuC..
...Cwc.yyyywuC..
...Cwc..yy.wuC..
...CwccccccwuC..
...CwwwwwwwwuC..
...CsSsSsSsSuC..
...CCCCCCCCCCC..
""", []),
}

CHALLENGE_ICONS = {
    'sales': ("""
................
................
................
................
................
................
................
................
................
................
................
................
""", [(COIN, 1, 8), (COIN, 1, 6), (COIN, 1, 4), (COIN, 6, 9), (COIN, 6, 7), (COIN, 10, 9), (COIN, 10, 3)]),
    'variety': ("""
................
................
................
................
................
................
................
................
................
................
""", [(['.dGd.', '..d..', 'yYYYy', '.YYo.', '.YYo.', '..Yo.', '..o..'], 0, 5),
          (['.dGd.', 'rRRRq', 'RrRRq', 'RRRqq', '.qqq.'], 10, 7),
          (['.gGGd.', 'gGgGGd', 'GgGdGd', 'GGdGdd', '.dddd.'], 5, 2)]),
    'sowing': ("""
................
................
.......gG.......
....gG.GG.......
....GGdd........
......d.........
......d.........
.....nbn........
....nbbbn.......
...nbkbbbn......
..nnbbbbbnn.....
.nnnnnnnnnnn....
""", []),
    'care': ("""
................
.....c..........
.....c..........
....cvc.........
....cvc.........
...cvccC........
...cwvcC........
...ccccC........
....CCC.........
................
""", [(['.EE.EE.', 'EpEEEEq', 'EpEEEEq', '.EEEEq.', '..EEq..', '...q...'], 8, 7)]),
    'quality': ("""
.......i........
.......y........
......yyy.......
......yiy.......
.....yyiyy......
iiyyyyiwiyyyyii.
..yyyiwwwiyyy...
.....yyiyy......
......yiy.......
......yyy.......
.......y........
.......i........
""", [(['.i.', 'iwi', '.i.'], 12, 10), (['.i.', 'iwi', '.i.'], 1, 1)]),
    'orders': ("""
................
................
...wwwwwwwww....
...wwwwwwwwws...
...wSSSSSSwws...
...wwwwwwwwws...
...wSSSSSwwws...
...wwwwwwwwws...
...wSSSSSSSws...
...wwwwwwwwws...
...wSSSwwwwws...
...wwwwwwwwws...
....sssssssss...
""", [(['.EE.', 'EpEq', 'EEqq', '.qq.'], 6, 0)]),
    'crates': ("""
................
................
................
....rR.gG.yY....
...rRRqGgGYYo...
..bbbbbbbbbbbb..
..bkkkkkkkkkkb..
..bnnnnnnnnnnb..
..bkkkkkkkkkkb..
..bnnnnnnnnnnb..
..bkkkkkkkkkkb..
..BBBBBBBBBBBB..
""", []),
    'apples': ("""
................
................
................
................
................
................
....N...........
..nnnnnnnnnnnn..
..nbknbknbknbn..
..nkbbkbbkbbkn..
..nbknbknbknbn..
...nnnnnnnnnn...
""", [(APPLE_S, 2, 3), (APPLE_S, 8, 3), (APPLE_S, 5, 1)]),
}


def tab_icon_section():
    for name, src in TAB_ICONS.items():
        add(f'icon.{name}', icon(src))


def card_icon_section():
    for cid in ('purse', 'seedFair', 'fertilizer'):
        src, st = CARD_ICONS[cid]
        add(f'icon.card.{cid}', stamp_icon(src, st))
    # poule couveuse sur son nid (poule de Tiny Farm, nid de paille)
    hen = img()
    hen.alpha_composite(icon("""
................
................
................
................
................
................
................
................
................
................
................
................
.yYyYyyYyYyYyy..
..YoYoYYoYoYo...
"""))
    hen.alpha_composite(shift(tile(2, 10), 0, -2))
    add('icon.card.hen', hen)
    src, st = CARD_ICONS['watering']
    add('icon.card.watering', stamp_icon(src, st))
    add('icon.card.clover', V3S['perk.clover'].copy())
    for cid in ('poster', 'landlord', 'bees', 'crier', 'cartHorse', 'clearing'):
        src, st = CARD_ICONS[cid]
        add(f'icon.card.{cid}', stamp_icon(src, st))
    add('icon.card.seedBag', g2.mini_sparkle(g2.golden(seedbag(EMBLEMS['pea'])), 12, 3, big=True))
    src, st = CARD_ICONS['recipe']
    add('icon.card.recipe', stamp_icon(src, st))
    add('icon.card.hay', tile(0, 8).copy())
    src, st = CARD_ICONS['almanac']
    add('icon.card.almanac', stamp_icon(src, st))


def challenge_icon_section():
    add('icon.challenge.harvests', V3S['perk.basket'].copy())
    for cid in ('sales', 'variety', 'sowing', 'care', 'quality', 'orders', 'crates'):
        src, st = CHALLENGE_ICONS[cid]
        add(f'icon.challenge.{cid}', stamp_icon(src, st))
    add('icon.challenge.products', V3S['product.jam'].copy())
    src, st = CHALLENGE_ICONS['apples']
    add('icon.challenge.apples', stamp_icon(src, st))
    add('icon.challenge.animals', tile(2, 10).copy())
    add('icon.challenge.collect', CAS['product.eggs'].copy())


def medal(kind):
    ramps = {'bronze': ('b', 'B', 'n', 'k'), 'silver': ('W', 's', 'S', 'w'), 'gold': ('y', 'Y', 'o', 'i')}
    if kind == 'empty':
        g = Grid(16, 16)
        for (x, y) in ellipse(8, 10, 4.6, 4.6):
            d = math.hypot(x + 0.5 - 8, y + 0.5 - 10)
            if d > 3.6 and (x + y) % 2 == 0:
                g.set(x, y, 'M')
        for y in range(1, 6):
            if y % 2:
                g.set(5 + (y > 2), y, 'M'); g.set(10 - (y > 2), y, 'M')
        return art(g.rows(), outline=0, w=16, h=16)
    c1, c2, c3, hi = ramps[kind]
    g = Grid(16, 16)
    # ruban en V (bleu et rouge)
    for y in range(0, 7):
        g.set(4 + y // 2, y, 'C'); g.set(5 + y // 2, y, 'C'); g.set(6 + y // 2, y, 'u')
        g.set(11 - y // 2, y, 'E'); g.set(10 - y // 2, y, 'E'); g.set(9 - y // 2, y, 'q')
    g.ball(8, 10.5, 4.8, 4.8, hi + c1 + c2 + c3, ring='A')
    for (x, y) in ellipse(8, 10.5, 2.6, 2.6):
        if g.get(x, y) != '.':
            g.set(x, y, c2 if (x + y) % 3 else c1)
    g.stamp(['.' + hi + '.', hi + 'w' + hi, '.' + hi + '.'], 7, 9)
    return art(g.rows(), outline=1, w=16, h=16)


def medal_section():
    for k in ('bronze', 'silver', 'gold', 'empty'):
        add(f'medal.{k}', medal(k))


# ===========================================================================
# 5. Objets du colporteur (item.<id>) et icônes des années à thème (icon.theme.<id>)

ITEM_ICONS = {
    'fertilizer': ("""
......nn........
......bn........
.....wsss.......
.....wsss.......
....wssssS......
...wjjjjjjS.....
...jgjjjjjJ.....
..jgjjjjjjjJ....
..jgjQQQQjjJ....
..jjjQwQQjjJ....
..jjjQQQQjJJ....
..JjjjjjjJJJ....
...JJJJJJJJ.....
""", [(['.i.', 'iwi', '.i.'], 11, 3)]),
    'usedCoop': ("""
................
.......q........
......qRq.......
.....qRRRq......
....qRRrRRq.....
...qRRRRRRRq....
..qqqqqqqqqqq...
...BbBbBbBbB....
...BbNNNNbbB....
...BbNHHNbbB....
...BbNHHNbkB....
...BbNHHNbbB....
...BBBBBBBBB....
....b.....n.....
""", [(['kb', 'bk'], 9, 7)]),
    'usedHive': ("""
................
....nnnnnnnn....
...nbbbbbbbbN...
..nNNNNNNNNNNN..
...ykyykyykyY...
...yyyyyyyyyY...
...YYYYYYYYYY...
...ykyykyykyY...
...yyyAAyyyyY...
...YYYYYYYYYY...
...bbbbbbbbbB...
....n......N....
""", [(['.ww.', 'yZyZ', '.yZ.'], 11, 5)]),
    'almanac': ("""
................
................
....nnnnnnnnn...
....nbbbbbbbNn..
....nbbbbyybNn..
....nbbbbbyyNn..
....nbbbbyybNn..
....nbyybbbbNn..
....nbbbbbbbNn..
....nbbbbbbbNn..
....nwwwwwwwwn..
....nnnnnnnnn...
""", [(['.w.', 'wyw', '.w.'], 6, 4)]),
    'horseshoe': ("""
................
................
..SSS......SSS..
..SWS......SsS..
..SsS......SWS..
..SsS......SsS..
..SWS......SsS..
..SsS......SsS..
..SsWS....SsSS..
...SssWssWsSS...
....SSSSSSSS....
.....MMMMMM.....
""", [(['..i..', '..y..', 'iywyi', '..y..', '..i..'], 6, 1)]),
    'lantern': ("""
......NNN.......
.....N...N......
......NNN.......
.....oYYYo......
....oyiiiyo.....
....yiwwiyY.....
....yiwiiyY.....
....yiiiiyY.....
....yyiiyyY.....
....oyyyyYo.....
.....ooooo......
......NNN.......
""", []),
    'weathervane': ("""
................
......99........
.....9889.......
....98889...99..
.......9889989..
.....998888889..
.....98888889...
......9999999...
..........9.....
..........9.....
.0999999999998..
..........S.....
..........S.....
..........S.....
""", []),
    'heirloom': ("""
.....nnnnn......
....nbbbbbN.....
.....NNNNN......
....wsssssS.....
...ws.....sS....
...wsRyGkRsS....
...wbNyRGbsS....
...wEEEEEEES....
...wEwwwwwES....
...wEEEEEEES....
...wGkRyNbsS....
...wsRGbykSS....
....SSSSSSS.....
""", []),
}

THEME_ICONS = {
    'bees': ("""
................
......ww.ww.....
.....wccwccw....
......wcwcw.....
...NyyyNyyNy....
..NyyyyNyyNyy...
.ZNyyyyNyyNyyy..
..NyAyyNyyNyy...
...NyyyNyyNy....
....NNNNNNN.....
................
""", []),
    'cheese': ("""
................
................
......iiii......
....iiiiiiiy....
..iiiiiiiiiiy...
..yiiiiiiiyyy...
..yyyyyyyyyYY...
..yyyoyyyyyYY...
..yyyyyyoyyYY...
..yoyyyyyyyYY...
..YYYYYYYYYYY...
""", [(['..yy', '.iyy', 'iiyY', 'yyYY'], 11, 7)]),
    'tourism': ("""
................
................
.........EE.....
...&&...++++....
..++++++++++++..
..+&&&&&&&&&&+..
..+&&&xxxx&&&+..
..+&&xcwcCx&&+..
..+&&xccCCx&&+..
..+&&xcCCCx&&+..
..+&&&xxxx&&&+..
..+&&&&&&&&&&+..
..++++++++++++..
""", []),
    'giants': ("""
................
.......dN.......
.......dN.gG....
.....yYYnYYdd...
...yiyYYyYYYY...
..yiyYYyYYyYYo..
..yyyYYyYYyYYo..
..yyYYYyYYYYoo..
..YyYYoYYYoYoo..
...YoYYoYYoYo...
....oooooooo....
................
""", [(['.CCC.', 'CwCwC', 'CCyCC', '.CCC.', '.E.E.', 'E...E'], 10, 8)]),
    'frogs': ("""
................
................
...gg.....gg....
..gwwg...gwwg...
..gwZg...gwZg...
..GGGGGGGGGGG...
.gGGGGGGGGGGGd..
.gGGGGGGGGGGGd..
.gGqqqqqqqqqGd..
..GGLLLLLLLGd...
...GGGGGGGGd....
..dd.......dd...
""", []),
    'markets': ("""
.......y........
......yiy.......
.......Y........
..nnnnnYnnnnnn..
..n....Y.....n..
.n.n...Y....n.n.
n...n..Y...n...n
yyyyy..Y..yyyyy.
.YYY...Y...YYY..
.......Y........
.....nnnnn......
....nnnnnnn.....
""", []),
    'lights': ("""
.......N........
.......N........
.....NNNNN......
....EEpEEEE.....
...EpyEEEEqE....
...EpyiEEEqE....
...EyiwiEEqE....
...EpyiEEEqE....
...EEyEEEqqE....
....EEEEEqE.....
.....NNNNN......
.......y........
.......Y........
""", []),
}


def item_section():
    for iid in ('fertilizer', 'usedCoop'):
        src, st = ITEM_ICONS[iid]
        add(f'item.{iid}', stamp_icon(src, st))
    add('item.hens', icon("""
................
................
...EE......EE...
..EEw......wEE..
..wwZy....yZww..
..wwww....wwww..
w.wwww....wwww.w
wwwwwws..swwwwww
wwWwwws..swwwWww
swwwwss..sswwwws
.ssssS....Sssss.
..y.y......y.y..
.yy.yy....yy.yy.
"""))
    src, st = ITEM_ICONS['usedHive']
    add('item.usedHive', stamp_icon(src, st))
    copper = {PAL['s']: PAL['8'], PAL['S']: PAL['9'], PAL['W']: (255, 214, 170), PAL['M']: PAL['0']}
    src, _ = CARD_ICONS['watering']
    add('item.copperCan', g3.recolor(stamp_icon(src, [(['.i.', 'iwi', '.i.'], 12, 1)]), copper))
    for iid in ('almanac', 'horseshoe', 'lantern', 'weathervane', 'heirloom'):
        src, st = ITEM_ICONS[iid]
        add(f'item.{iid}', stamp_icon(src, st))


def theme_icon_section():
    for tid in ('bees', 'cheese', 'tourism', 'giants', 'frogs'):
        src, st = THEME_ICONS[tid]
        add(f'icon.theme.{tid}', stamp_icon(src, st))
    add('icon.theme.orchard', V3S['tree.apple.icon'].copy())
    add('icon.theme.bread', V3S['product.bread'].copy())
    for tid in ('markets', 'lights'):
        src, st = THEME_ICONS[tid]
        add(f'icon.theme.{tid}', stamp_icon(src, st))


# ===========================================================================
# Assemblage

SECTIONS = [crop_section, scene_section, portrait_section, tab_icon_section, card_icon_section,
            challenge_icon_section, medal_section, item_section, theme_icon_section]


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
    return f"{{ sheet: 'lot3', col: {c}, row: {r}" + (f', w: {w}, h: {h}' if (w, h) != (1, 1) else '') + ' }'


HEADER = """// Lot 3 (planche « lot3 », assets/sprites/lot3.png) : « variété » dessinée dans le style Kenney.
// Tableau du village board.village (32 × 32) et feuilles board.note[.kept|.done] ; charrette du marché
// cart.market[.1] (32 × 32, âne vers la DROITE) ; roulotte merchant.wagon[.1] (32 × 32, avant à DROITE) ;
// Basile npc.merchant[.walk] (de face, comme npc.joseph) ; cultures rares pea / melon / leek (crop.<id>.1..4,
// .icon, .dead, .icon.gold, seedbag.<id>, sack.<id>, crate.<id>, crop.<id>.giant 32 × 32) et crate.apple ;
// portraits 32 × 32 portrait.client.<id>, portrait.merchant, portrait.theme.<id> ; icônes icon.board / cart /
// cards / challenge / merchant / theme / rare, icon.card.<id>, icon.challenge.<id>, medal.*, item.<id>,
// icon.theme.<id> ; stands fair.theme.<id> ; décors lantern.peddler, weathervane.rooster, sign.magazine.
// Ajoutés à SPRITES ici même (Object.assign), après sa définition."""


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
    sheet.save(HERE / 'lot3.png', optimize=True)
    lines = [HEADER, '// Généré par assets/sprites/generate-lot3.py — ne pas modifier à la main.', 'const lot3 = {']
    for name, _ in ENTRIES:
        lines.append(f"  '{name}': {js_entry(*pos[name])},")
    for name, target in ALIASES:
        lines.append(f"  '{name}': {js_entry(*pos[target])},")
    lines.append('};')
    lines.append('Object.assign(SPRITES, lot3);')
    lines.append("// Étape 0 des cultures rares : la tuile commune « graines semées » (comme les cultures v3).")
    lines.append("for (const id of ['pea', 'melon', 'leek']) SPRITES[`crop.${id}.0`] = SPRITES['crop.seeds'];")
    block = '\n'.join(lines)
    atlas = ROOT / 'src' / 'render' / 'atlas.js'
    src = atlas.read_text()
    if '// <lot3:auto>' not in src:
        raise SystemExit('marqueurs // <lot3:auto> absents de src/render/atlas.js')
    new = re.sub(r'(// <lot3:auto>\n).*?(// </lot3:auto>)', lambda m: m.group(1) + block + '\n' + m.group(2),
                 src, flags=re.S)
    atlas.write_text(new)
    print(f'écrit {HERE / "lot3.png"} ({SHEET_COLS} × {rows} tuiles, {len(ENTRIES)} sprites, {len(ALIASES)} alias)')
    if args.contact:
        contact_sheets(Path(args.contact))


def group_of(name):
    if name.startswith(('crop.', 'seedbag.', 'sack.', 'crate.')):
        return 'crops'
    if name.startswith('portrait.'):
        return 'portraits'
    if name.startswith(('board.', 'cart.', 'merchant.', 'npc.', 'lantern.', 'weathervane.', 'sign.', 'fair.')):
        return 'scene'
    return 'icons'


def contact_sheets(folder, scale=6):
    """Planches de contrôle : chaque groupe à ×scale, à côté d'originaux (Kenney, v3, carrière, lot 2)."""
    folder.mkdir(parents=True, exist_ok=True)
    refs = {
        'crops': [tile(6, 0), tile(6, 4), tile(8, 0), V3S['crop.pumpkin.4'], V3S['crop.zucchini.4'],
                  V3S['crop.pumpkin.icon'], tile(10, 0), tile(11, 0)],
        'portraits': [CAS['portrait.joseph'], CAS['portrait.staff.f110']],
        'scene': [tile(0, 9), CAS['npc.joseph'], CAS['fair.stand']],
        'icons': [g2.weather_icon(g2.gi.ICONS[n]) for n in ('coin', 'calendar', 'harvest', 'seed')],
    }
    groups = {k: [] for k in refs}
    for name, im in ENTRIES:
        groups[group_of(name)].append(im)
    for key, ims in groups.items():
        for bgname, bg in (('', (132, 198, 105, 255)), ('-parchment', (255, 241, 210, 255))):
            if bgname and key not in ('icons', 'portraits'):
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
            out.save(folder / f'lot3-art-contact-{key}{bgname}.png')


if __name__ == '__main__':
    main()
