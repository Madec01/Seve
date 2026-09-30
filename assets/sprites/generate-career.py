#!/usr/bin/env python3
"""Génère assets/sprites/career.png : sprites du mode Carrière dessinés dans le style Kenney (CC0).

Même méthode que generate-v3.py (dont on réutilise la palette et les outils) :
  - dessins ASCII (une lettre = une couleur de la palette Kenney, « . » = vide), contour sombre
    (63, 38, 49) de 2 px ajouté automatiquement autour de la silhouette, lumière en haut à gauche ;
  - bâtiments assemblés à partir des tuiles Kenney (Tiny Town / Tiny Farm) ou remplis avec leurs
    textures (tuiles, ardoises, planches, pierre), complétés de détails dessinés ;
  - personnages : gabarit du fermier de Tiny Farm (mêmes proportions, mêmes contours), recolorié
    (tenue, cheveux, peau) et décliné en fermières, en poses (repos, marche, travail) et en portraits.

Le script :
  1. dessine chaque sprite ;
  2. les range dans la planche (placement automatique, déterministe, 32 tuiles de large) ;
  3. écrit assets/sprites/career.png ;
  4. réécrit, dans src/render/atlas.js, le bloc compris entre « // <career:auto> » et
     « // </career:auto> » (objet `career` des entrées de la planche « career » et fonctions
     d'aide : staffSprite, staffPortrait, lookKey…).

Relancer après modification :  python3 assets/sprites/generate-career.py   (nécessite Pillow)
Planche de contrôle (×4, avec les originaux Kenney) : python3 assets/sprites/generate-career.py --contact DOSSIER
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

_spec = importlib.util.spec_from_file_location('gen_v3', HERE / 'generate-v3.py')
g3 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(g3)

T = 16
SHEET_COLS = 32
OUT = g3.OUT
PAL = dict(g3.PAL)
FARM, TOWN = g3.FARM, g3.TOWN
V3 = Image.open(HERE / 'v3.png').convert('RGBA')
art, compose, img, tile, recolor, paint, flip, Grid, wither, lum = (
    g3.art, g3.compose, g3.img, g3.tile, g3.recolor, g3.paint, g3.flip, g3.Grid, g3.wither, g3.lum)

# Quelques teintes supplémentaires (toutes voisines de la palette Kenney) : rose du cochon, gris de
# l'acier, bleu nuit des corbeaux. Lettres libres de la palette v3.
PAL.update({
    'K': (255, 190, 170),   # rose clair (cochon)
    'L': (236, 140, 138),   # rose (cochon, ombre ; oreilles des lapins)
    'O': (190, 90, 100),    # rose foncé (groin)
    'X': (61, 33, 45),      # presque contour (plumes du corbeau) — relevé dans Tiny Farm
    'H': (119, 56, 51),     # brun très sombre (relevé dans Tiny Farm)
    'I': (184, 101, 66),    # brun (relevé dans Tiny Town)
})


def art(rows, outline=2, pal=None, w=None, h=None):
    """art() de generate-v3.py, avec la palette étendue par défaut."""
    return g3.art(rows, outline=outline, pal=pal or PAL, w=w, h=h)


def v3_sprites():
    """Tuiles de la planche v3 par nom (lues dans le bloc v3:auto d'atlas.js)."""
    src = (ROOT / 'src' / 'render' / 'atlas.js').read_text()
    out = {}
    for m in re.finditer(r"'([\w.]+)': \{ sheet: 'v3', col: (\d+), row: (\d+)(?:, w: (\d+), h: (\d+))? \}", src):
        n, c, r, w, h = m.group(1), int(m.group(2)), int(m.group(3)), int(m.group(4) or 1), int(m.group(5) or 1)
        out[n] = V3.crop((c * T, r * T, (c + w) * T, (r + h) * T))
    return out


V3S = v3_sprites()


def town(c, r, w=1, h=1):
    return tile(c, r, TOWN, w, h)


def farm(c, r, w=1, h=1):
    return tile(c, r, FARM, w, h)


def over(base, top, x=0, y=0):
    out = base.copy()
    out.alpha_composite(top, (x, y))
    return out


def canvas(wt, ht):
    """Image vide de wt × ht tuiles."""
    return img(wt * T, ht * T)


def grid_tiles(rows, sheet=TOWN):
    """Assemble des tuiles Kenney : rows = lignes de (col, row) ou None ; renvoie une image."""
    h = len(rows)
    w = max(len(r) for r in rows)
    out = canvas(w, h)
    for y, line in enumerate(rows):
        for x, cell in enumerate(line):
            if cell is None:
                continue
            if isinstance(cell, Image.Image):
                out.alpha_composite(cell, (x * T, y * T))
            else:
                out.alpha_composite(tile(cell[0], cell[1], sheet), (x * T, y * T))
    return out


def outline_image(im, width=2):
    """Ajoute un contour sombre autour de la silhouette d'une image déjà colorée."""
    w, h = im.size
    px = im.load()
    filled = {(x, y) for y in range(h) for x in range(w) if px[x, y][3]}
    ring = set()
    for (x, y) in filled:
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                q = (x + dx, y + dy)
                if q not in filled and 0 <= q[0] < w and 0 <= q[1] < h:
                    ring.add(q)
    if width >= 2:
        allp = filled | ring
        ring2 = set()
        for (x, y) in allp:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                q = (x + dx, y + dy)
                if q not in allp and 0 <= q[0] < w and 0 <= q[1] < h:
                    ring2.add(q)
        ring |= ring2
    out = im.copy()
    op = out.load()
    for q in ring:
        op[q] = OUT + (255,)
    return out


def rows_of(im, pal=None):
    """Image → lignes ASCII (lettres de la palette ; « . » = transparent, « ? » = inconnue)."""
    inv = {v: k for k, v in (pal or PAL).items()}
    inv[OUT] = 'A'
    px = im.load()
    return [''.join('.' if px[x, y][3] == 0 else inv.get(px[x, y][:3], '?') for x in range(im.width))
            for y in range(im.height)]


def gray(im):
    """Version grisée (succès non obtenus) : luminance ramenée sur des gris-violet de la palette."""
    im = im.copy()
    px = im.load()
    ramp = [(63, 38, 49), (90, 105, 136), (139, 155, 180), (192, 203, 220), (235, 239, 248)]
    for y in range(im.height):
        for x in range(im.width):
            p = px[x, y]
            if not p[3] or p[:3] == OUT:
                continue
            l = lum(p)
            k = 1 if l < 110 else 2 if l < 170 else 3 if l < 225 else 4
            px[x, y] = ramp[k] + (p[3],)
    return im


# ---------------------------------------------------------------------------
# Registre : nom → image (ou composé)

ENTRIES = []     # (nom, image) dans l'ordre de placement
ALIASES = []     # (nom, nom_cible) : même entrée sous un autre nom
EXTERNAL = []    # (nom, code JS) : entrées pointant vers d'autres planches (composés Kenney)
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


def external(name, js):
    assert name not in _seen, name
    _seen.add(name)
    EXTERNAL.append((name, js))


def has(name):
    return name in _seen


def get(name):
    for n, im in ENTRIES:
        if n == name:
            return im
    raise KeyError(name)


# ===========================================================================
# 1. Personnages : employés (fermiers et fermières), joueur au féminin, Joseph, villageois
#
# Gabarit : le fermier de Tiny Farm relevé pixel par pixel, en lettres « sémantiques » :
#   A contour · H/h chapeau (clair/ombre) · b ruban du chapeau · S/s peau (claire/ombre) · E yeux
#   K ombre du cou · R/r cheveux (clair/foncé) · C/c chemise (claire/ombre) · O salopette · o bouton
#   F chaussures
# Les lettres sont ensuite remplacées par les couleurs d'une apparence (tenue, cheveux, peau).

HAT_M = [
    '....AAAAAAAA....',
    '...AAAAAAAAAA...',
    '.AAAAhhHHhhAAAA.',
    'AAAAAhhhhhhAAAAA',
    'AAHhAbbbbbbAhHAA',
    'AAHhhhhhhhhhhHAA',
    'AAAHHHHHHHHHHAAA',
    '.AAAssEsssEsAAA.',
    '..AASSESSSESAA..',
    '..AAASSsssSAAA..',
    '.AAACOKccKOCAAA.',
    'AAACCOCCCCOCCAAA',
    'AASScOoOOoOcSSAA',
    'AASSAOOOOOOASSAA',
    'AAAAAOOAAOOAAAAA',
    '.AAAAFFAAFFAAAA.',
]
NOHAT_M = [
    '................',
    '....AAAAAAAA....',
    '...AAAAAAAAAA...',
    '..AAArRRRRrAAA..',
    '..AArRRRRRRrAA..',
    '..AARRSRRRSRAA..',
    '..AARSSSSSSSAA..',
    '..AASSESSSESAA..',
    '..AAsSEsssEsAA..',
    '..AAAssSSSsAAA..',
    '.AAACOKKKKOCAAA.',
] + HAT_M[11:]
# Fermière : cheveux longs qui tombent sur les épaules (frange pleine sans chapeau)
NOHAT_F = [
    '................',
    '....AAAAAAAA....',
    '...AAAAAAAAAA...',
    '..AAArRRRRrAAA..',
    '.AAArRRRRRRrAAA.',
    '.AArRRRRRRRRrAA.',
    '.AArRSSSSSSRrAA.',
    '.AArSSESSSESrAA.',
    '.AArsSEsssEsrAA.',
    '.AArAssSSSsArAA.',
    '.AArCOKKKKOCrAA.',
    'AAArCOCCCCOCrAAA',
] + HAT_M[12:]
HAT_F = HAT_M[:7] + [
    '.AARssEsssEsrAA.',
    '.AARSSESSSESrAA.',
    '.AARASSsssSArAA.',
    '.AARCOKccKOCrAA.',
    'AAARCOCCCCOCrAAA',
] + HAT_M[12:]


def _set(rows, x, y, ch):
    r = rows[y]
    rows[y] = r[:x] + ch + r[x + 1:]


def pose_walk(rows):
    """Marche : le corps monte d'1 px, la jambe gauche (à l'écran) se lève."""
    body = rows[1:14]
    legs = [
        'AAAAAOOAAOOAAAAA',
        'AAAAAFFAAOOAAAAA',
        '.AAAAAAAAFFAAAA.',
    ]
    return body + legs


def pose_work(rows):
    """Travail : accroupi (1 px plus bas), bras droit (à l'écran) levé, main sous le bord du chapeau."""
    out = ['................'] + list(rows[0:12]) + [rows[12], rows[14], rows[15]]
    right = {
        8: 'ASSA', 9: 'ASsA', 10: 'ACcA', 11: 'CCCcA', 12: 'CcAA', 13: 'AAA.',
    }
    for y, seg in right.items():
        for i, ch in enumerate(seg):
            if ch != '.':
                _set(out, 12 + i if y != 11 else 11 + i, y, ch)
    _set(out, 15, 13, '.') if out[13][15] == 'A' and out[12][15] == 'A' else None
    return out


# Teintes (cheveux, peau) : les 4 « teintes » d'une apparence
HAIR = {
    'brown': ('n', 'N'),
    'blonde': ('y', 'Y'),
    'auburn': ('R', 'q'),
    'black': ('z', 'Z'),
    'grey': ('W', 's'),
}
SKIN = {  # (clair, ombre, cou)
    'medium': ('f', 'F', 'n'),
    'fair': ('l', 'e', 'b'),
    'tan': ('b', 'B', 'n'),
    'dark': ('n', 'I', 'H'),
}
TINTS = [('brown', 'medium'), ('blonde', 'fair'), ('auburn', 'tan'), ('black', 'dark')]

# Tenues : exactement celles de la v3 (farmer.outfit.0..3)
OUTFIT_COLORS = [
    {'C': 'r', 'c': 'R', 'O': 'x', 'o': (140, 156, 181)},     # 0 : chemise rouge, salopette bleu marine
    {'C': 'plaid', 'c': 'q', 'O': 'n', 'o': 'b'},             # 1 : chemise à carreaux, salopette brune
    {'C': 'i', 'c': 'y', 'O': 'C', 'o': 'y'},                 # 2 : chemise jaune, salopette bleu vif
    {'C': 'W', 'c': 's', 'O': 'G', 'o': 'g'},                 # 3 : chemise blanche, tablier vert
]
HAT_COLORS = {'H': 'k', 'h': 'B', 'b': 'R'}


def _rgb(v):
    return PAL[v] if isinstance(v, str) else v


def person(rows, outfit=0, hair='brown', skin='medium', hat=None, extra=None):
    """Gabarit ASCII sémantique → image 16 × 16 colorée."""
    oc = OUTFIT_COLORS[outfit]
    sk = SKIN[skin]
    hc = HAIR[hair]
    cmap = {'A': OUT, 'E': PAL['Z'], 'F': PAL['n'],
            'S': _rgb(sk[0]), 's': _rgb(sk[1]), 'K': _rgb(sk[2]),
            'R': _rgb(hc[0]), 'r': _rgb(hc[1]),
            'c': _rgb(oc['c']), 'O': _rgb(oc['O']), 'o': _rgb(oc['o'])}
    for k, v in (hat or HAT_COLORS).items():
        cmap[k] = _rgb(v)
    if extra:
        for k, v in extra.items():
            cmap[k] = _rgb(v)
    plaid = oc['C'] == 'plaid'
    if not plaid:
        cmap['C'] = _rgb(oc['C'])
    h = len(rows)
    w = max(len(r) for r in rows)
    im = img(max(16, -(-w // 16) * 16), max(16, -(-h // 16) * 16))
    px = im.load()
    for y, line in enumerate(rows):
        for x, ch in enumerate(line):
            if ch in '. ':
                continue
            if ch == 'C' and plaid:
                c = PAL['R']
                if x % 3 == 0 or y % 3 == 0:
                    c = PAL['Z']
                if x % 3 == 0 and y % 3 == 0:
                    c = PAL['q']
                px[x, y] = c + (255,)
                continue
            if ch == 'c' and plaid:
                px[x, y] = PAL['q'] + (255,)
                continue
            px[x, y] = cmap[ch] + (255,) if ch in cmap else PAL[ch] + (255,)
    return im


GENDERS = ('m', 'f')
POSES = ('idle', 'walk', 'walk2', 'work')


def base_rows(gender, hat):
    if gender == 'f':
        return HAT_F if hat else NOHAT_F
    return HAT_M if hat else NOHAT_M


def posed(rows, pose):
    if pose == 'walk':
        return pose_walk(list(rows))
    if pose == 'work':
        return pose_work(list(rows))
    return list(rows)


def staff_image(gender, outfit, hat, tint, pose='idle'):
    hair, skin = TINTS[tint]
    rows = posed(base_rows(gender, hat), 'walk' if pose == 'walk2' else pose)
    im = person(rows, outfit, hair, skin)
    return flip(im) if pose == 'walk2' else im


def look_key(gender, outfit, hat, tint):
    return f'{gender}{outfit}{hat}{tint}'


# --- Portraits 32 × 32 (tête et épaules) --------------------------------------------------

def ellipse_cells(cx, cy, rx, ry):
    cells = set()
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            if ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1.0:
                cells.add((x, y))
    return cells


def portrait_rows(gender='m', hat=False, kind='staff', expr='content'):
    """Portrait en lettres sémantiques (mêmes lettres que les sprites ; M bouche, W blanc de l'œil,
    B joues, G sourcils / moustache, Q casquette, q ombre de la casquette, P visière)."""
    g = Grid(32, 32)
    cx = 16
    # --- épaules, chemise, salopette
    for y in range(22, 32):
        k = min(1.0, (y - 22) / 5)
        half = 7 + round(6 * k)
        for x in range(cx - half, cx + half):
            g.set(x, y, 'C' if x < cx + half - 3 else 'c')
    # bretelles et bavette de salopette
    for y in range(24, 32):
        g.set(cx - 6, y, 'O'); g.set(cx - 5, y, 'O')
        g.set(cx + 4, y, 'O'); g.set(cx + 5, y, 'O')
    for y in range(27, 32):
        for x in range(cx - 6, cx + 6):
            g.set(x, y, 'O')
    g.set(cx - 5, 28, 'o'); g.set(cx + 4, 28, 'o')
    # --- cheveux longs (derrière le visage)
    if gender == 'f' and kind == 'staff':
        for (x, y) in ellipse_cells(cx, 14, 10.5, 11):
            if 4 <= y <= 20:
                g.set(x, y, 'R' if x < cx + 5 else 'r')
        for y in range(14, 25):
            for x in list(range(cx - 10, cx - 6)) + list(range(cx + 6, cx + 10)):
                if y < 24 or x in (cx - 9, cx - 8, cx + 7, cx + 8):
                    g.set(x, y, 'R' if x < cx else 'r')
    # cou
    for y in range(19, 24):
        for x in range(cx - 3, cx + 3):
            g.set(x, y, 'K' if y >= 21 else 's')
    # col de chemise
    for x in range(cx - 4, cx + 4):
        if x in (cx - 4, cx + 3):
            g.set(x, 22, 'C')
    g.set(cx - 3, 23, 'C'); g.set(cx + 2, 23, 'C')
    # --- oreilles
    for (x, y) in ((cx - 9, 13), (cx - 9, 14), (cx - 9, 15), (cx + 8, 13), (cx + 8, 14), (cx + 8, 15)):
        g.set(x, y, 'S' if x < cx else 's')
    g.set(cx - 8, 14, 's'); g.set(cx + 7, 14, 's')
    # --- visage
    face = ellipse_cells(cx, 13.0, 8.2, 8.6)
    for (x, y) in face:
        if 4 <= y <= 21:
            g.set(x, y, 's' if x >= cx + 5 or y >= 20 else 'S')
    # --- cheveux (dessus)
    if kind == 'staff':
        cap = ellipse_cells(cx, 10.5, 8.8, 7.2)
        for (x, y) in cap:
            if y <= 8 or (y <= 10 and (x <= cx - 6 or x >= cx + 5)):
                g.set(x, y, 'R' if x < cx + 4 else 'r')
        if gender == 'f':
            # frange
            for x in range(cx - 7, cx + 7):
                g.set(x, 9, 'R' if (x + 1) % 4 else 'r')
            for (x, y) in ((cx - 8, 10), (cx - 8, 11), (cx - 8, 12), (cx + 7, 10), (cx + 7, 11), (cx + 7, 12)):
                g.set(x, y, 'R' if x < cx else 'r')
        else:
            # mèches
            for x in (cx - 4, cx - 1, cx + 2):
                g.set(x, 9, 'R'); g.set(x + 1, 9, 'r')
            for (x, y) in ((cx - 8, 11), (cx + 7, 11)):
                g.set(x, y, 'r')
    # --- yeux, sourcils, nez, bouche, joues
    ey = 14
    if expr in ('content', 'proud', 'happy'):
        if expr == 'proud':
            for x in (cx - 5, cx - 4, cx - 3, cx + 2, cx + 3, cx + 4):
                g.set(x, ey, 'E')
            g.set(cx - 6, ey + 1, 'E'); g.set(cx + 5, ey + 1, 'E')
            g.set(cx - 2, ey + 1, 'E'); g.set(cx + 1, ey + 1, 'E')
        elif expr == 'happy':
            for (x, y) in ((cx - 5, ey), (cx - 4, ey - 1), (cx - 3, ey), (cx + 2, ey), (cx + 3, ey - 1), (cx + 4, ey)):
                g.set(x, y, 'E')
        else:
            for dx in (-5, -4, 3, 4):
                g.set(cx + dx - (1 if dx > 0 else 0), ey, 'E')
                g.set(cx + dx - (1 if dx > 0 else 0), ey + 1, 'E')
            g.set(cx - 5, ey, 'W'); g.set(cx + 2, ey, 'W')
    elif expr == 'surprised':
        for (x0) in (cx - 6, cx + 2):
            for (dx, dy) in ((1, 0), (2, 0), (0, 1), (3, 1), (0, 2), (3, 2), (1, 3), (2, 3)):
                g.set(x0 + dx, ey - 1 + dy, 'E')
            g.set(x0 + 1, ey, 'W'); g.set(x0 + 2, ey, 'W'); g.set(x0 + 1, ey + 1, 'W'); g.set(x0 + 2, ey + 1, 'E')
            g.set(x0 + 1, ey + 1, 'E')
    # joues
    for (x, y) in ((cx - 6, 17), (cx - 5, 17), (cx + 4, 17), (cx + 5, 17)):
        g.set(x, y, 'B')
    # nez
    g.set(cx - 1, 16, 's'); g.set(cx, 16, 's')
    # bouche
    if kind == 'staff' or expr == 'content':
        for x in range(cx - 2, cx + 2):
            g.set(x, 19, 'M')
        g.set(cx - 3, 18, 'M'); g.set(cx + 2, 18, 'M')
    # --- chapeau de paille
    if hat and kind == 'staff':
        for (x, y) in ellipse_cells(cx, 9.5, 15, 3.2):
            g.set(x, y, 'H' if y <= 9 else 'h')
        for y in range(1, 9):
            for x in range(cx - 7, cx + 7):
                if y == 1 and x in (cx - 7, cx + 6):
                    continue
                g.set(x, y, 'h' if x >= cx + 4 else 'H')
        for x in range(cx - 7, cx + 7):
            g.set(x, 6, 'b'); g.set(x, 7, 'b')
        for x in range(cx - 6, cx + 6):
            g.set(x, 1, 'h' if x >= cx + 3 else 'H')
    return g.rows()


def portrait_image(rows, outfit, hair, skin, pal_extra=None):
    oc = OUTFIT_COLORS[outfit]
    extra = {'M': PAL['q'], 'W': PAL['w'], 'B': PAL['r'] if skin != 'dark' else PAL['R'], 'G': PAL['W']}
    if skin == 'fair':
        extra['B'] = PAL['r']
    if pal_extra:
        extra.update(pal_extra)
    im = person(rows, outfit, hair, skin, extra=extra)
    return outline_image(im)


def staff_portrait(gender, outfit, hat, tint):
    hair, skin = TINTS[tint]
    return portrait_image(portrait_rows(gender, bool(hat)), outfit, hair, skin)


# --- Joseph : vieux fermier, casquette, moustache et barbe blanches ------------------------

def joseph_portrait(expr='content'):
    g = Grid(32, 32)
    base = portrait_rows('m', False, kind='joseph', expr=expr)
    for y, line in enumerate(base):
        for x, ch in enumerate(line):
            if ch != '.':
                g.set(x, y, ch)
    cx = 16
    # cheveux gris sur les côtés
    for (x, y) in ((cx - 9, 10), (cx - 9, 11), (cx - 9, 12), (cx - 8, 10), (cx - 8, 11), (cx - 8, 12),
                   (cx + 7, 10), (cx + 7, 11), (cx + 7, 12), (cx + 8, 10), (cx + 8, 11), (cx + 8, 12)):
        g.set(x, y, 'G' if x < cx else 'r')
    # casquette plate (drap vert-de-gris) avec visière
    for (x, y) in ellipse_cells(cx, 8.5, 9.5, 5.5):
        if y <= 9:
            g.set(x, y, 'Q' if x < cx + 5 else 'q')
    for x in range(cx - 9, cx + 11):
        g.set(x, 10, 'P')
    for x in range(cx - 7, cx + 12):
        g.set(x, 11, 'P' if x < cx + 11 else '.')
    g.set(cx - 2, 4, 'q'); g.set(cx - 1, 4, 'q')
    # sourcils broussailleux
    by = 12 if expr != 'surprised' else 11
    for x in (cx - 6, cx - 5, cx - 4, cx + 3, cx + 4, cx + 5):
        g.set(x, by, 'G')
    # barbe (menton et joues) et grosse moustache
    for (x, y) in ellipse_cells(cx, 19.5, 7.0, 4.2):
        if y >= 18:
            g.set(x, y, 'G' if x < cx + 4 else 'r')
    for x in range(cx - 5, cx + 5):
        g.set(x, 17, 'G' if x < cx + 3 else 'r')
    g.set(cx - 6, 18, 'G'); g.set(cx + 5, 18, 'r')
    # bouche
    if expr == 'surprised':
        for (x, y) in ((cx - 1, 19), (cx, 19), (cx - 1, 20), (cx, 20)):
            g.set(x, y, 'M')
    elif expr == 'proud':
        for x in range(cx - 2, cx + 3):
            g.set(x, 19, 'M')
        g.set(cx + 3, 18, 'M')
    else:
        for x in range(cx - 2, cx + 2):
            g.set(x, 19, 'M')
    # nez rond
    g.set(cx - 1, 15, 's'); g.set(cx, 15, 's'); g.set(cx - 1, 16, 'B'); g.set(cx, 16, 'B')
    # chemise à carreaux brune sous la salopette (tenue 1) ; peau hâlée ridée
    rows = g.rows()
    im = person(rows, 1, 'grey', 'medium',
                extra={'M': PAL['q'], 'W': PAL['w'], 'B': PAL['r'], 'G': PAL['W'],
                       'Q': PAL['J'], 'q': PAL['d'], 'P': PAL['N']})
    return outline_image(im)


# Joseph en sprite 16 × 16 : casquette verte, moustache blanche, chemise à carreaux, salopette brune
JOSEPH_ROWS = [
    '................',
    '....AAAAAAAA....',
    '...AAAAAAAAAA...',
    '..AAAQQQQQqAAA..',
    '..AAQQQQQQQqAAA.',
    '..AAPPPPPPPPPPA.',
    '..AAGSSSSSSGAAA.',
    '..AAGSESSSESAA..',
    '..AAsSEsssEsAA..',
    '..AAAGGGGGGAAA..',
    '.AAACOGGGGOCAAA.',
] + HAT_M[11:]


def joseph_image(pose='idle'):
    rows = posed(JOSEPH_ROWS, 'walk' if pose == 'walk2' else pose)
    im = person(rows, 1, 'grey', 'medium',
                extra={'G': PAL['W'], 'Q': PAL['J'], 'q': PAL['d'], 'P': PAL['N']})
    return flip(im) if pose == 'walk2' else im


# Villageois : dame au panier (robe, chignon gris), touriste (chapeau de soleil, appareil photo),
# enfant (plus petit, casquette rouge)
LADY_ROWS = [
    '................',
    '.....AAAAAA.....',
    '....AAWWWsAA....',
    '...AAAWWWsAAA...',
    '..AAAWWWWWsAAA..',
    '..AAWSSSSSSsAA..',
    '..AAWSESSSESAA..',
    '..AAsSEsssEsAA..',
    '..AAAssSSSsAAA..',
    '.AAAPPKKKKPPAAA.',
    'AAAPPPPwwPPPPAAA',
    'AASSPPPPPPPPSSAA',
    'AASSPQPQPQPPSSAA',
    'AAAAPPPPPPPPAAAA',
    '.AAAAFFAAFFAAAA.',
    '..AAAAAAAAAAAA..',
]
TOURIST_ROWS = [
    '................',
    '....AAAAAAAA....',
    '...AAAAAAAAAA...',
    '.AAAAyyyyyYAAAA.',
    'AAAAAbbbbbbAAAAA',
    'AAyyyyyyyyyyyYAA',
    'AAAAAAAAAAAAAAAA',
    '..AASSESSSESAA..',
    '..AAsSEsssEsAA..',
    '..AAAssSSSsAAA..',
    '.AAAcCZZZZCcAAA.',
    'AAAccCZSSZCccAAA',
    'AASScCZZZZCcSSAA',
    'AASSAOOOOOOASSAA',
    'AAAAAOOAAOOAAAAA',
    '.AAAAFFAAFFAAAA.',
]
CHILD_ROWS = [
    '................',
    '................',
    '................',
    '.....AAAAAA.....',
    '....AAAAAAAAA...',
    '...AAREEERRAAA..',
    '...AAQQQQQQQQAA.',
    '...AASSSSSSAAA..',
    '...AASESSESAA...',
    '...AAAssssAAA...',
    '..AAACCCCCCAAA..',
    '..ASSCCCCCCSSA..',
    '..AAAOOOOOOAAA..',
    '...AAOOAAOOAA...',
    '...AAFFAAFFAA...',
    '....AAAAAAAA....',
]


def villager(n, pose='idle'):
    if n == 1:
        rows = LADY_ROWS
        extra = {'P': PAL['P'], 'Q': PAL['Q'], 'W': PAL['W'], 's': PAL['F'], 'w': PAL['w']}
        im = person(rows if pose == 'idle' else _walk_generic(rows), 0, 'grey', 'fair', extra=extra)
        # panier au bras
        im = over(im, art(['.nnnn.', 'n....n', 'bbbbbb', 'bBbBbB', '.BBBB.'], outline=1, w=16, h=16), 0, 8)
        return im
    if n == 2:
        rows = TOURIST_ROWS
        im = person(rows if pose == 'idle' else _walk_generic(rows), 2, 'brown', 'fair',
                    extra={'Z': PAL['Z'], 'y': PAL['y'], 'Y': PAL['Y']})
        return im
    rows = CHILD_ROWS
    return person(rows if pose == 'idle' else _walk_generic(rows), 2, 'blonde', 'medium',
                  extra={'R': PAL['R'], 'Q': PAL['q'], 'E': PAL['R'], 'C': PAL['v'], 'O': PAL['C']})


def _walk_generic(rows):
    """Marche générique : corps relevé d'1 px, jambes écartées sur les deux dernières lignes."""
    out = list(rows[1:]) + ['................']
    # dernière rangée : pieds (on décale le pied gauche vers l'extérieur)
    return out


TOOL_ART = {
    # arrosoir tenu à la main gauche (à l'écran)
    'can': ['..SSS.....', '.S...S....', 'MsssssM.ss', 'MssssssMs.', 'MSSSSSSM..', '.MMMMMM...'],
    # panier d'osier avec quelques légumes
    'basket': ['.nnnnn.', 'n.....n', 'rYGrGYr', 'bbbbbbb', 'bBbBbBb', 'BbBbBbB', '.BBBBB.'],
    # sac de graines
    'seedbag': ['.bBb.', 'bkkkb', 'kkgkk', 'kgGgk', 'kkgkB', '.bBB.'],
    # seau
    'pail': ['.MMMMM.', 'M.....M', 'sSSSSSM', 'sSSSSSM', 'sSSSSSM', '.MMMMM.'],
    # binette
    'hoe': ['SSS', 'SSn', '..n', '..n', '..n', '..n', '..n', '..n'],
}


def tool_carry(kind):
    """Outil porté à la main gauche (repos, marche) : à dessiner par-dessus le personnage."""
    pat = TOOL_ART[kind]
    t = art(pat, outline=1, w=16, h=16)
    ox, oy = {'can': (0, 9), 'basket': (0, 9), 'seedbag': (0, 10), 'pail': (0, 10), 'hoe': (0, 5)}[kind]
    out = img(16, 16)
    out.alpha_composite(t, (ox, oy))
    return out


def tool_work(kind):
    """Outil en action, tenu par la main levée (pose « work »)."""
    pat = TOOL_ART[kind]
    t = art(pat, outline=1, w=16, h=16)
    out = img(16, 16)
    if kind == 'can':
        t = t.rotate(-25, resample=Image.NEAREST, expand=False)
        out.alpha_composite(t, (5, 2))
        paint(out, ['c', '.', 'c.c', '..c'], 14, 11) if False else None
        for (x, y) in ((15, 11), (14, 13), (15, 14)):
            out.putpixel((x, y), PAL['c'] + (255,))
    elif kind == 'hoe':
        out.alpha_composite(t, (11, 1))
    elif kind == 'basket':
        out.alpha_composite(t, (9, 3))
    elif kind == 'seedbag':
        out.alpha_composite(t, (10, 4))
        for (x, y) in ((11, 12), (13, 13), (12, 14)):
            out.putpixel((x, y), PAL['b'] + (255,))
    else:
        out.alpha_composite(t, (9, 4))
    return out


def people_section():
    # Employés : genre × tenue × chapeau × teinte × pose (le nom encode l'apparence, voir lookKey)
    for gender in GENDERS:
        for outfit in range(4):
            for hat in (1, 0):
                for tint in range(4):
                    key = look_key(gender, outfit, hat, tint)
                    add(f'staff.{key}', staff_image(gender, outfit, hat, tint, 'idle'))
                    for pose in ('walk', 'walk2', 'work'):
                        add(f'staff.{key}.{pose}', staff_image(gender, outfit, hat, tint, pose))
    # Joueuse (fermière) : mêmes 4 tenues que farmer.outfit.N, cheveux bruns, peau du fermier Kenney
    for i in range(4):
        add(f'farmer.fermiere.outfit.{i}', person(HAT_F, i, 'brown', 'medium'))
        add(f'farmer.fermiere.outfit.{i}.nohat', person(NOHAT_F, i, 'brown', 'medium'))
    for kind in TOOL_ART:
        add(f'tool.{kind}' if kind != 'hoe' else 'tool.hoe.carry', tool_carry(kind))
        add(f'tool.{kind}.work', tool_work(kind))
    add('npc.joseph', joseph_image('idle'))
    add('npc.joseph.walk', joseph_image('walk'))
    add('npc.joseph.walk2', joseph_image('walk2'))
    for n in (1, 2, 3):
        add(f'npc.visitor.{n}', villager(n))
        add(f'npc.visitor.{n}.walk', villager(n, 'walk'))


def portrait_section():
    for gender in GENDERS:
        for outfit in range(4):
            for hat in (1, 0):
                for tint in range(4):
                    add(f'portrait.staff.{look_key(gender, outfit, hat, tint)}',
                        staff_portrait(gender, outfit, hat, tint))
    add('portrait.joseph', joseph_portrait('content'))
    add('portrait.joseph.surprised', joseph_portrait('surprised'))
    add('portrait.joseph.proud', joseph_portrait('proud'))
    add('portrait.joseph.happy', joseph_portrait('happy'))


# ===========================================================================
# 2. Animaux (regard vers la DROITE, comme le mouton, la vache, la poule et la chèvre : le rendu
#    retourne l'image pour la gauche). Contour ajouté par art().

PIG = [
    '................',
    '................',
    '................',
    '..........LK....',
    '....KKKKKKKKK...',
    '...KKKKKKKKKKK..',
    '.LLKKKKKKKKZKK..',
    '..KKKKKKKKKKKOO.',
    '..LKKKKKKKKKKOH.',
    '..LKKKKKKKKKKK..',
    '..LLKKKKKKKKLL..',
    '...LLLLLLLLLL...',
    '...L.L...L.L....',
    '...O.O...O.O....',
]
PIG_WALK = PIG[:12] + [
    '....L.L..L.L....',
    '....O.O.O..O....',
]
PIG_SNIFF = [  # museau au sol (il cherche une truffe)
    '................',
    '................',
    '................',
    '................',
    '....KKKKKK......',
    '...KKKKKKKKK....',
    '..LKKKKKKKKKKL..',
    '..KKKKKKKKKKKKK.',
    '..LKKKKKKKKKLZK.',
    '..LKKKKKKKKKKKK.',
    '..LLKKKKKKKKLKKO',
    '...LLLLLLLLLLOHO',
    '...L.L...L.L....',
    '...O.O...O.O....',
]

RABBIT = [  # lapin angora assis : oreilles dressées, fourrure touffue
    '................',
    '................',
    '................',
    '.........w.w....',
    '........wLwL....',
    '........wLwL....',
    '........wwwws...',
    '.......wwwZwws..',
    '...w.wwwwwwwwp..',
    '..wwwwwwwwwwws..',
    '..wwWwwwwwWwss..',
    '..swwwwwwwwwss..',
    '...ssswwwssss...',
    '....SSs..SSs....',
]
RABBIT_HOP = [
    '................',
    '................',
    '...........w.w..',
    '..........wLwL..',
    '..........wLwL..',
    '..........wwwws.',
    '...w.w...wwwZws.',
    '..wwwwwwwwwwwwp.',
    '..wwWwwwwwwwwws.',
    '..swwwwwWwwwss..',
    '...sswwwwwwss...',
    '..SSs.sss..SSs..',
    '................',
    '................',
]
RABBIT_COLORS = {
    'white': {},
    'brown': {'w': 'b', 'W': 'k', 's': 'B', 'S': 'n', 'L': 'L', 'p': 'O'},
}


def rabbit(color, hop=False):
    pal = dict(PAL)
    pal['L'] = PAL['L']
    pal['p'] = PAL['L']
    for k, v in RABBIT_COLORS[color].items():
        pal[k] = PAL[v]
    return art(RABBIT_HOP if hop else RABBIT, pal=pal)


# Cheval (2 × 2 tuiles, 32 × 32) : robe brune, crinière et queue claires, balzanes
def horse(frame='idle'):
    g = Grid(32, 32)
    graze = frame == 'graze'
    # corps
    for y in range(12, 22):
        for x in range(6, 25):
            if (y == 12 and (x < 8 or x > 22)) or (y == 21 and (x < 7 or x > 23)):
                continue
            g.set(x, y, 'n')
    for x in range(8, 23):
        g.set(x, 12, 'B')
    for x in range(7, 24):
        g.set(x, 13, 'B' if x < 20 else 'n')
    for x in range(7, 24):
        g.set(x, 21, 'N')
    # jambes (avant à droite)
    legs = [(8, 0), (11, 1), (20, 0), (23, 1)]
    if frame == 'walk':
        legs = [(7, 1), (12, 0), (19, 1), (24, 0)]
    for (x, back) in legs:
        for y in range(22, 29):
            g.set(x, y, 'N' if back else 'n')
            g.set(x + 1, y, 'N' if back else 'I')
        g.set(x, 27, 'W'); g.set(x + 1, 27, 'W')
        g.set(x, 28, 'Z'); g.set(x + 1, 28, 'Z')
    # encolure et tête
    if not graze:
        neck = [(22, 11), (23, 10), (24, 9), (25, 8), (25, 7)]
        for (x, y) in neck:
            for yy in range(y, 15):
                for xx in range(x - 2, x + 2):
                    g.set(xx, yy, 'n')
        head = ['.nnnn...', 'nnnnnnn.', 'nnZnnnnn', 'nnnnnnnnI', '..nnnnnIN', '...nnIIN.']
        g.stamp(head, 23, 3)
        g.stamp(['.n', 'nN'], 24, 1)   # oreille
        # crinière claire
        for (x, y) in ((22, 3), (22, 4), (21, 5), (21, 6), (20, 7), (20, 8), (19, 9), (19, 10), (19, 11),
                       (23, 3), (23, 4), (22, 5), (22, 6), (21, 7), (21, 8), (20, 9), (20, 10), (20, 11)):
            g.set(x, y, 'k' if (x + y) % 3 else 'i')
    else:
        # tête baissée vers l'herbe
        for (x, y) in ((23, 13), (24, 14), (25, 15), (25, 16), (26, 17)):
            for yy in range(y - 2, y + 3):
                for xx in range(x - 1, x + 3):
                    g.set(xx, yy, 'n')
        head = ['.nnnn.', 'nnnnnn', 'nZnnnn', 'nnnnnn', 'nnnnnI', '.nnnIN', '..nIN.']
        g.stamp(head, 25, 17)
        g.stamp(['n.', 'Nn'], 26, 15)
        for (x, y) in ((22, 10), (23, 11), (24, 12), (25, 13), (26, 14), (21, 11), (22, 12), (23, 13), (24, 14)):
            g.set(x, y, 'k' if (x + y) % 3 else 'i')
        g.stamp(['GgG', 'GdGG'], 27, 26)  # touffe d'herbe
    # queue claire (à gauche)
    for (x, y) in ((5, 13), (4, 14), (4, 15), (3, 16), (3, 17), (3, 18), (4, 19), (4, 20), (5, 14), (5, 15)):
        g.set(x, y, 'k' if y < 17 else 'i')
    # reflet du dos
    for x in range(10, 17):
        g.set(x, 14, 'B' if x % 3 else 'n')
    return art(g.rows(), w=32, h=32)


# Canard (phase B) : blanc à bec orange
DUCK = [
    '................',
    '................',
    '................',
    '................',
    '..........ww....',
    '.........wwZw...',
    '.........wwwyy..',
    '.........wwwY...',
    '..s.....wwww....',
    '..swwwwwwwww....',
    '..swwWWwwwwws...',
    '...swwwwwwwss...',
    '....sssssss.....',
    '.....y...y......',
]
DUCK_WALK = DUCK[:13] + ['......y.y.......']
DUCK_SWIM = DUCK[:11] + [
    '..cCsssssssCc...',
    '.cCcCcCcCcCcCc..',
    '................',
]

CROW = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '.........zzz....',
    '........zzwzy...',
    '........zzzzYy..',
    '...Z...zzzzz....',
    '...ZZzzzxzzz....',
    '....ZZzxxzzZ....',
    '.....ZZZzzZ.....',
    '.......Y.Y......',
    '.......YY.YY....',
]
CROW_FLY1 = [
    '................',
    '................',
    '..Z.............',
    '..ZZ......Z.....',
    '...ZZ....ZZ.....',
    '...ZZZ..ZZz.zzz.',
    '....ZZzzZzzzzwzy',
    '.....ZzxxzzzzzYy',
    '...ZZzxxzzzzz...',
    '....ZZZzzzz.....',
    '.......ZZ.......',
    '................',
    '................',
    '................',
]
CROW_FLY2 = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '..........zzz...',
    '....ZzzzzzzzwzY.',
    '...ZZzxxzzzzzYy.',
    '..ZZZzxxzzzzz...',
    '..ZZZZzzzZZ.....',
    '...ZZZ.ZZZZ.....',
    '....Z...ZZ......',
    '.........Z......',
    '................',
]


def animal_section():
    add('animal.pig', art(PIG))
    add('animal.pig.walk.1', art(PIG_WALK))
    add('animal.pig.sniff', art(PIG_SNIFF))
    for color in ('white', 'brown'):
        add(f'animal.rabbit.{color}', rabbit(color))
        add(f'animal.rabbit.{color}.hop', rabbit(color, True))
    alias('animal.rabbit', 'animal.rabbit.white')
    add('animal.horse', horse('idle'))
    add('animal.horse.walk.1', horse('walk'))
    add('animal.horse.graze', horse('graze'))
    add('bird.crow', art(CROW))
    add('bird.crow.fly.1', art(CROW_FLY1))
    add('bird.crow.fly.2', art(CROW_FLY2))


def duck_section():
    add('animal.duck', art(DUCK))
    add('animal.duck.walk.1', art(DUCK_WALK))
    add('animal.duck.swim', art(DUCK_SWIM))


# ===========================================================================
# 3. Bâtiments : outils de construction (textures Kenney, toits à pignon façon Tiny Farm)

def rgba(c):
    return (PAL[c] if isinstance(c, str) else c) + (255,)


def crop_tex(sheet, c, r, x0=0, y0=0, w=16, h=16):
    return sheet.crop((c * T + x0, r * T + y0, c * T + x0 + w, r * T + y0 + h))


def _thatch():
    t = img(8, 6)
    rows = ['yyYyyyiy', 'yYyiyYyy', 'YyyyYyyY', 'yiyYyyoy', 'yyYyiyyY', 'oYyyyYyy']
    for y, line in enumerate(rows):
        for x, ch in enumerate(line):
            t.putpixel((x, y), rgba(ch))
    return t


def _wood_roof():
    t = img(8, 8)
    rows = ['bbbBbbbb', 'bbbBbbbb', 'bbbBbbbb', 'BBBBBBBB', 'bbbbbbbB', 'bbbbbbbB', 'bbbbbbbB', 'BBBBBBBB']
    for y, line in enumerate(rows):
        for x, ch in enumerate(line):
            t.putpixel((x, y), rgba(ch))
    return t


def _metal():
    t = img(8, 4)
    rows = ['WWsssssS', 'Wssss sS'.replace(' ', 's'), 'WssssssS', 'SSSSSSSM']
    for y, line in enumerate(rows):
        for x, ch in enumerate(line):
            t.putpixel((x, y), rgba(ch))
    return t


TEX = {
    'green.l': crop_tex(FARM, 9, 8, 3, 0, 12, 16),
    'green.r': crop_tex(FARM, 11, 8, 0, 0, 12, 16),
    'red': crop_tex(TOWN, 5, 4, 0, 4, 16, 10),
    'slate': crop_tex(TOWN, 1, 4, 0, 4, 16, 10),
    'thatch': _thatch(),
    'woodroof': _wood_roof(),
    'wood': crop_tex(TOWN, 1, 6),
    'stone': crop_tex(TOWN, 5, 6),
    'barn': crop_tex(FARM, 7, 8),
    'white': V3S['part.wall.white.c'],
    'planks': crop_tex(FARM, 7, 9, 0, 1, 16, 12),
    'metal': _metal(),
}
TEX['woodlight'] = recolor(TEX['wood'], {PAL['n']: PAL['b'], PAL['N']: PAL['B'], PAL['b']: PAL['k']})
TEX['brick'] = recolor(TEX['stone'], {PAL['S']: PAL['R'], PAL['s']: PAL['r'], PAL['M']: PAL['q']})
# Couleurs associées : (clair du bord supérieur, ombre du bas / avant-toit)
ROOF_TRIM = {
    'green.l': ('G', 'd'), 'green.r': ('g', 'G'), 'red': ('r', 'q'), 'slate': ('s', 'M'),
    'thatch': ('i', 'o'), 'woodroof': ('k', 'B'),
}
# Pans de toit (gauche sombre / droite claire) par matière
ROOF_PANELS = {
    'green': ('green.l', 'green.r'),
    'red': ('red', 'red'),
    'slate': ('slate', 'slate'),
    'thatch': ('thatch', 'thatch'),
    'wood': ('woodroof', 'woodroof'),
}


def shade(c, k):
    """Assombrit une couleur RGBA (pan de toit à l'ombre)."""
    return (int(c[0] * k), int(c[1] * k), int(c[2] * k), c[3])


def fill(im, cells, tex, ox=0, oy=0, dark=1.0):
    t = TEX[tex] if isinstance(tex, str) else tex
    tw, th = t.size
    px = im.load()
    tp = t.load()
    for (x, y) in cells:
        if 0 <= x < im.width and 0 <= y < im.height:
            c = tp[(x - ox) % tw, (y - oy) % th]
            if c[3] == 0:
                continue
            px[x, y] = c if dark == 1.0 else shade(c, dark)


def rect_cells(x0, y0, x1, y1):
    return [(x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)]


def fill_rect(im, x0, y0, x1, y1, tex, ox=None, oy=None, dark=1.0):
    fill(im, rect_cells(x0, y0, x1, y1), tex, x0 if ox is None else ox, y0 if oy is None else oy, dark)


def hline(im, x0, x1, y, c):
    for x in range(x0, x1 + 1):
        if 0 <= x < im.width and 0 <= y < im.height:
            im.putpixel((x, y), rgba(c) if c != 'A' else OUT + (255,))


def vline(im, x, y0, y1, c):
    for y in range(y0, y1 + 1):
        if 0 <= x < im.width and 0 <= y < im.height:
            im.putpixel((x, y), rgba(c) if c != 'A' else OUT + (255,))


def dot(im, x, y, c):
    if 0 <= x < im.width and 0 <= y < im.height:
        im.putpixel((x, y), rgba(c) if c != 'A' else OUT + (255,))


def stamp(im, rows, x, y, outline=1):
    """Dessin ASCII (contour de `outline` px ajouté autour) posé avec son coin de remplissage en (x, y)."""
    o = outline
    w = max(len(r) for r in rows) + 2 * o
    h = len(rows) + 2 * o
    W, H = -(-w // T) * T, -(-h // T) * T
    padded = ['.' * W] * o + ['.' * o + r.ljust(W - o, '.') for r in rows]
    t = art(padded, outline=o, w=W, h=H) if o else art(padded, outline=0, w=W, h=H)
    im.alpha_composite(t, (x - o, y - o)) if x - o >= 0 and y - o >= 0 else im.paste(t, (x - o, y - o), t)
    return im


def paste(im, src, x, y):
    if x >= 0 and y >= 0 and x + src.width <= im.width and y + src.height <= im.height:
        im.alpha_composite(src, (x, y))
    else:
        tmp = img(im.width, im.height)
        tmp.paste(src, (x, y), src)
        im.alpha_composite(tmp)


def finish(im, width=2):
    return outline_image(im, width)


# Portes et fenêtres (dessins ASCII, contour d'1 px ajouté par stamp)
DOOR_X = [  # porte de grange à croix (Tiny Farm)
    'kkkkkkkkkk', 'kRkkkkkkRk', 'kkRkkkkRkk', 'kkkRkkRkkk', 'kkkkRRkkkk', 'kkkkRRkkkk',
    'kkkRkkRkkk', 'kkRkkkkRkk', 'kRkkkkkkRk', 'kkkkkkkkkk',
]
DOOR_X_BIG = [
    'kkkkkkkkkkkkkk', 'kRRkkkkkkkkRRk', 'kkRRkkkkkkRRkk', 'kkkRRkkkkRRkkk', 'kkkkRRkkRRkkkk',
    'kkkkkRRRRkkkkk', 'kkkkkRRRRkkkkk', 'kkkkRRkkRRkkkk', 'kkkRRkkkkRRkkk', 'kkRRkkkkkkRRkk',
    'kRRkkkkkkkkRRk', 'kkkkkkkkkkkkkk',
]
DOOR_WOOD = ['NNNNNN', 'NnnnnN', 'NnNnnN', 'NnNnnN', 'NnNnkN', 'NnNnnN', 'NnNnnN', 'NnNnnN', 'NnnnnN']
DOOR_DOUBLE = [  # porte à deux battants (écurie), partie haute ouverte à gauche
    'NNNNNNNNNNNN', 'NZZZZNNnnnnN', 'NZZZZNNnNnnN', 'NZZZZNNnNnnN', 'NNNNNNNNNNNN',
    'NnnnnNNnnnnN', 'NnNnnNNnNnnN', 'NnNnkNNkNnnN', 'NnNnnNNnNnnN', 'NnnnnNNnnnnN',
]
DOOR_HATCH = ['NNNN', 'NZZN', 'NZZN', 'NZZN']
WINDOW = ['MMMM', 'MccM', 'MzzM', 'MMMM']
WINDOW_WIDE = ['MMMMMM', 'McMccM', 'MzMzzM', 'MMMMMM']
MESH = ['SsSsSsSs', 'sZsZsZsZ', 'SsSsSsSs', 'sZsZsZsZ', 'SsSsSsSs', 'sZsZsZsZ']

# Enseignes : petite planche avec l'emblème de l'animal (4 × 4 sans contour sur fond clair)
EMBLEM = {
    'hen': ['.RR.', '.wwy', 'wwww', '.ww.'],
    'egg': ['.kk.', 'kkkk', 'kkkb', '.bb.'],
    'sheep': ['wwwZ', 'wwwZ', 'wwww', 'Z.Z.'],
    'goat': ['...s', 'bbbb', 'bbbb', 'N.N.'],
    'cow': ['wZww', 'wwZw', 'wwww', 'Z.Z.'],
    'pig': ['.LKL', 'KKKO', 'KKKK', 'L.L.'],
    'rabbit': ['w.w.', 'w.w.', 'wwww', 'www.'],
    'horse': ['NNNN', 'N..N', 'N..N', 'N..N'],   # fer à cheval
    'duck': ['.ww.', '.wwy', 'wwww', '.ww.'],
}


def sign_board(emblem):
    rows = ['kkkkkk', 'k....k', 'k....k', 'k....k', 'k....k', 'bbbbbb']
    e = EMBLEM[emblem]
    rows = [r[:1] + (e[i - 1] if 1 <= i <= 4 else r[1:5]).replace('.', 'k') + r[5:] if 1 <= i <= 4 else r
            for i, r in enumerate(rows)]
    return rows


def gable_barn(im, x0, x1, yt, ye, yb, roof='green', wall='barn', trim=None, door='x', gable_window=True,
               windows=(), emblem=None, door_rows=None):
    """Grange à pignon vue de face (langage de la grange Tiny Farm) : deux pans de toit en V,
    pignon triangulaire en façade, mur bas avec porte.  Coordonnées en pixels, bornes incluses."""
    cx2 = x0 + x1  # centre ×2 (pour les largeurs paires)
    half = (x1 - x0 + 1) / 2
    ya = ye - int(half) + 2          # sommet du pignon
    left, right = ROOF_PANELS[roof]
    # toit : rectangle au-dessus de l'avant-toit, moins le pignon
    for y in range(yt, ye + 1):
        for x in range(x0, x1 + 1):
            d = abs(2 * x + 1 - cx2 - 1) / 2       # distance au centre
            inside_gable = y >= ya and d <= (y - ya) + 0.5
            if inside_gable:
                continue
            tex = left if 2 * x + 1 <= cx2 + 1 else right
            fill(im, [(x, y)], tex, x0, yt)
    # bord supérieur clair
    lt, dk = ROOF_TRIM[left][0], ROOF_TRIM[right][0]
    hline(im, x0, x1, yt, lt)
    # faîtage : poutre claire du haut jusqu'au sommet du pignon
    mid = cx2 // 2
    for y in range(yt, ya):
        dot(im, mid, y, 'h'); dot(im, mid + (1 if cx2 % 2 else 0), y, 'h')
    # pignon : mur
    gable = [(x, y) for y in range(ya, ye + 1) for x in range(x0, x1 + 1)
             if abs(2 * x + 1 - cx2 - 1) / 2 <= (y - ya) + 0.5]
    fill(im, gable, wall, x0, yt)
    # avant-toit en V (contour de 2 px) le long des rives
    for y in range(ya - 2, ye + 1):
        k = y - ya
        for side in (-1, 1):
            for t in (1.5, 2.5):
                x = (cx2 + 1) / 2 + side * (k + t) - 0.5
                xi = int(round(x - 0.01 * side))
                if x0 <= xi <= x1:
                    dot(im, xi, y, 'A')
    # mur bas
    fill_rect(im, x0, ye + 1, x1, yb, wall, x0, yt)
    hline(im, x0, x1, ye + 1, 'A')
    if trim:
        hline(im, x0, x1, ye + 2, trim)
        vline(im, x0, ye + 2, yb, trim); vline(im, x1, ye + 2, yb, trim)
    # lucarne du fenil
    gw = 4
    if gable_window and ye - ya >= 7:
        stamp(im, WINDOW if wall != 'barn' else ['kkkk', 'kNNk', 'kNNk'], mid - gw // 2 + (0 if cx2 % 2 else 1) - 0, ye - 6)
    # fenêtres
    for (wx, wy) in windows:
        stamp(im, WINDOW, wx, wy)
    # porte
    pattern = door if isinstance(door, list) else {
        'x': DOOR_X, 'xbig': DOOR_X_BIG, 'wood': DOOR_WOOD, 'double': DOOR_DOUBLE, 'hatch': DOOR_HATCH}.get(door)
    if pattern:
        dw = len(pattern[0])
        dh = len(pattern)
        stamp(im, pattern, (cx2 + 1) // 2 - dw // 2, yb - dh + 1)
    if emblem:
        stamp(im, sign_board(emblem), (cx2 + 1) // 2 - 3, ye - 7 if not gable_window else ye + 3)
    return im


def lean_to(im, x0, x1, yt, yb, roof='wood', wall='wood', high='left', door=None, window=None):
    """Appentis : toit à un pan (bord haut côté `high`), mur dessous."""
    ye = yt + 5
    for y in range(yt, ye + 1):
        for x in range(x0, x1 + 1):
            fill(im, [(x, y)], ROOF_PANELS[roof][1], x0, yt)
    hline(im, x0, x1, yt, ROOF_TRIM[ROOF_PANELS[roof][1]][0])
    hline(im, x0, x1, ye, ROOF_TRIM[ROOF_PANELS[roof][1]][1])
    fill_rect(im, x0 + 1, ye + 1, x1 - 1, yb, wall)
    hline(im, x0 + 1, x1 - 1, ye + 1, 'A')
    if door:
        stamp(im, door, (x0 + x1) // 2 - len(door[0]) // 2, yb - len(door) + 1)
    if window:
        stamp(im, window, (x0 + x1) // 2 - len(window[0]) // 2, ye + 3)
    return im


# Petits accessoires (avec contour)
HAY = ['yyiyyy', 'yYyyYy', 'YyyYyY', 'yyYyyy', 'oYooYo']
TROUGH = ['nnnnnnnn', 'nccccccn', 'NnnnnnnN', '.N....N.']
TROUGH_FEED = ['nnnnnnnn', 'nyYyyYyn', 'NnnnnnnN', '.N....N.']
MUD = ['...NNNNNNNN...', '.NNnnnNNNnnNN.', 'NNnnNNNNNNnnNN', '.NNNNnnNNNNNN.', '...NNNNNNNN...']
FENCE_H = ['b.......b.......b', 'bbbbbbbbbbbbbbbbb', 'B.......B.......B', 'bbbbbbbbbbbbbbbbb', 'B.......B.......B']
WEATHERVANE = ['..Y..', 'YYYYY', '..Y..', '..o..', '..o..']
CUPOLA = ['.RRRRR.', 'RRRRRRR', 'qkkkkkq', 'qkZkZkq', 'qkkkkkq']
FLOWERBOX = ['pRpPp', 'GdGdG', 'nnnnn']
RAMP = ['......nn', '....nnNn', '..nnNn..', 'nnNn....']


# ===========================================================================
# 4. Abris d'animaux (3 × 3 tuiles ; clapier 2 × 2 / 3 × 2), niveaux 1, 2, 3
#    niv. 1 : petite cabane ; niv. 2 : grange à pignon ; niv. 3 : grange agrandie (annexe, lanternon)

SHELTER_STYLE = {
    'coop':      dict(roof='red', wall='wood', door='hatch', emblem='hen', trim=None),
    'sheepfold': dict(roof='slate', wall='stone', door='wood', emblem='sheep', trim=None),
    'goatShed':  dict(roof='thatch', wall='woodlight', door='wood', emblem='goat', trim=None),
    'cowshed':   dict(roof='green', wall='barn', door='x', emblem='cow', trim='k'),
    'pigsty':    dict(roof='red', wall='stone', door='wood', emblem='pig', trim=None),
    'stable':    dict(roof='slate', wall='wood', door='double', emblem='horse', trim=None),
}


def shelter(kind, level):
    st = SHELTER_STYLE[kind]
    im = canvas(3, 3)
    door = st['door']
    if level == 1:
        if kind == 'coop':
            # petit poulailler sur pieds
            for y in range(14, 21):
                for x in range(9, 35):
                    fill(im, [(x, y)], 'red', 9, 14)
            hline(im, 9, 34, 14, 'r'); hline(im, 9, 34, 20, 'q')
            fill_rect(im, 10, 21, 33, 35, 'wood')
            hline(im, 10, 33, 21, 'A')
            stamp(im, DOOR_HATCH, 14, 30)
            stamp(im, WINDOW, 25, 24)
            hline(im, 10, 33, 36, 'A')
            for lx in (12, 30):
                vline(im, lx, 37, 44, 'N'); vline(im, lx + 1, 37, 44, 'n')
        elif kind == 'pigsty':
            lean_to(im, 6, 29, 20, 44, roof='red', wall='stone', door=DOOR_WOOD)
        else:
            gable_barn(im, 8, 35, 14, 31, 44, st['roof'], st['wall'], st['trim'],
                       door if door != 'double' else 'wood', gable_window=False, emblem=None)
        if kind == 'coop':
            stamp(im, RAMP, 18, 37)
            stamp(im, TROUGH_FEED, 36, 40)
        if kind == 'pigsty':
            stamp(im, MUD, 29, 39)
        elif kind != 'coop':
            stamp(im, HAY, 38, 39)
    elif level == 2:
        gable_barn(im, 4, 43, 3, 27, 45, st['roof'], st['wall'], st['trim'],
                   'xbig' if door == 'x' else door, gable_window=True, emblem=st['emblem'])
        if kind == 'coop':
            stamp(im, RAMP, 26, 38)
        if kind == 'pigsty':
            stamp(im, MUD, 31, 40)
    else:
        lean_to(im, 30, 45, 22, 45, roof=st['roof'] if st['roof'] not in ('green', 'thatch') else 'wood',
                wall=st['wall'], window=WINDOW if kind != 'coop' else DOOR_HATCH)
        gable_barn(im, 2, 35, 7, 27, 45, st['roof'], st['wall'], st['trim'],
                   'xbig' if door == 'x' else door, gable_window=True, emblem=st['emblem'])
        stamp(im, CUPOLA if kind in ('cowshed', 'stable', 'sheepfold') else WEATHERVANE,
              16 if kind in ('cowshed', 'stable', 'sheepfold') else 17, 2)
        if kind == 'pigsty':
            stamp(im, MUD, 31, 40)
        elif kind == 'coop':
            stamp(im, RAMP, 24, 38)
        else:
            stamp(im, HAY, 38, 40)
    return finish(im)


def hutch(level):
    """Clapier sur pieds : caisse en planches, façade grillagée, petit toit ; niv. 1 2 × 2, niv. 2-3 3 × 2."""
    wt = 2 if level == 1 else 3
    im = canvas(wt, 2)
    W = wt * T
    x0, x1 = 3, W - 4
    boxes = 1 if level == 1 else 2
    # toit à un pan
    for y in range(3, 10):
        for x in range(x0 - 1, x1 + 2):
            fill(im, [(x, y)], 'woodroof' if level < 3 else 'red', 0, 3)
    hline(im, x0 - 1, x1 + 1, 3, 'k' if level < 3 else 'r')
    hline(im, x0 - 1, x1 + 1, 9, 'B' if level < 3 else 'q')
    # caisse
    fill_rect(im, x0, 10, x1, 22, 'woodlight')
    hline(im, x0, x1, 10, 'A')
    n = boxes + (1 if level == 3 else 0)
    cw = (x1 - x0 + 1) // n
    for i in range(n):
        bx = x0 + i * cw
        if i > 0:
            vline(im, bx, 11, 22, 'N')
        stamp(im, [r[:cw - 5] for r in MESH], bx + 3, 13)
    # pieds
    for lx in (x0 + 1, x1 - 2) + ((x0 + cw * 1,) if n > 1 else ()):
        vline(im, lx, 23, 28, 'N'); vline(im, lx + 1, 23, 28, 'n')
    hline(im, x0, x1, 23, 'A')
    # botte de foin / carotte
    stamp(im, ['..G', '.Gd', 'YY.', 'Yo.'], x1 - 5, 25) if level >= 2 else None
    return finish(im)


def shelter_section():
    for kind in SHELTER_STYLE:
        for level in (1, 2, 3):
            add(f'building.{kind}.{level}', shelter(kind, level))
    for level in (1, 2, 3):
        add(f'building.hutch.{level}', hutch(level))


# ===========================================================================
# 5. Maison (5 niveaux), grenier / silos, chambre d'hôte, boutique de la ferme
#    Assemblées à partir des tuiles Tiny Town (toits, murs, portes, fenêtres), plus les murs chaulés
#    de la v3 et quelques détails dessinés (jardinières, tour, fanion, enseignes).

S_ROOF = {'l': (0, 4), 'c': (1, 4), 'r': (2, 4), 'chim': (3, 4),
          'bl': (0, 5), 'bc': (1, 5), 'br': (2, 5), 'gable': (3, 5)}
R_ROOF = {k: (c + 4, r) for k, (c, r) in S_ROOF.items()}
WOOD = {'l': (0, 6), 'c': (1, 6), 'doorway': (2, 6), 'r': (3, 6),
        'win': (0, 7), 'door': (1, 7), 'ddl': (2, 7), 'ddr': (3, 7)}
STONE = {k: (c + 4, r) for k, (c, r) in WOOD.items()}


def tw(c):
    """Tuile Tiny Town (col, row) ou image v3 par nom."""
    if isinstance(c, str):
        return V3S[c]
    return town(*c)


def house_grid(rows):
    return grid_tiles([[tw(c) if c is not None else None for c in line] for line in rows])


def flowerbox(im, x, y, flowers='pRpRp'):
    stamp(im, [flowers, 'GdGdG', 'nnnnn'], x, y)


def house_level(level):
    S, W = S_ROOF, WOOD
    if level == 1:
        return house_grid([
            [S['l'], S['chim'], S['c'], S['r']],
            [S['bl'], S['bc'], S['gable'], S['br']],
            [W['l'], W['win'], W['door'], W['r']],
        ])
    if level == 2:
        im = house_grid([
            [S['l'], S['c'], S['chim'], S['c'], S['r']],
            [S['bl'], S['bc'], S['gable'], S['bc'], S['br']],
            [W['l'], W['win'], W['door'], W['win'], W['r']],
        ])
        flowerbox(im, 21, 45)
        flowerbox(im, 53, 45, 'yPyPy')
        return im
    if level == 3:
        im = house_grid([
            [S['l'], S['chim'], S['c'], S['c'], S['r']],
            [S['bl'], S['bc'], S['gable'], S['bc'], S['br']],
            [W['l'], W['win'], W['win'], W['win'], W['r']],
            [W['l'], W['win'], W['door'], W['win'], W['r']],
        ])
        for x in (21, 53):
            flowerbox(im, x, 45)
            flowerbox(im, x, 61, 'yPyPy')
        return im
    R, ST = R_ROOF, STONE
    if level == 4:
        im = canvas(6, 4)
        main = house_grid([
            [R['l'], R['chim'], R['c'], R['r']],
            [R['bl'], R['gable'], R['bc'], R['br']],
            [ST['l'], ST['win'], ST['win'], ST['r']],
            [ST['l'], ST['win'], ST['door'], ST['r']],
        ])
        wing = house_grid([
            [R['c'], R['r']],
            [R['bc'], R['br']],
            [ST['ddl'], ST['ddr']],
        ])
        # l'aile se termine par un mur de pierre à droite
        wing_edge = town(7, 6)
        wing.alpha_composite(wing_edge.crop((12, 0, 16, 16)), (28, 32))
        paste(im, wing, 64, 16)
        paste(im, main, 0, 0)
        flowerbox(im, 21, 61)
        flowerbox(im, 5, 61, 'yPyPy')
        return im
    # 5 : manoir chaulé, toit d'ardoise, tour ronde à toit conique et fanion (6 × 5)
    return manor(flag='gold' if level == 'flag' else 'red')


def manor(flag='red'):
    im = canvas(6, 5)
    S = S_ROOF
    main = house_grid([
        [S['l'], S['chim'], S['c'], S['c'], S['chim'], S['r']],
        ['part.roof.slate.white.l', 'part.roof.slate.white.c', 'part.roof.slate.white.gable',
         'part.roof.slate.white.c', 'part.roof.slate.white.c', 'part.roof.slate.white.r'],
        ['part.wall.white.l', 'part.wall.white.window', 'part.wall.white.window', 'part.wall.white.window',
         'part.wall.white.window', 'part.wall.white.r'],
        ['part.wall.white.l', 'part.wall.white.window', 'part.wall.white.door', 'part.wall.white.window',
         'part.wall.white.window', 'part.wall.white.r'],
    ])
    paste(im, main, 0, 16)
    for x in (21, 53, 69):
        flowerbox(im, x, 77 - 16, 'pRpRp')
    # tour ronde à gauche
    tower = img(96, 80)
    x0, x1 = 3, 26
    for y in range(22, 78):
        for x in range(x0, x1 + 1):
            c = 'W' if x < x0 + 3 else 'S' if x > x1 - 4 else 's'
            if y % 7 == 3 and (x + y // 7) % 5 and x0 + 1 < x < x1 - 1:
                c = 'S' if c != 'S' else 'M'
            dot(tower, x, y, c)
    for (wx, wy) in ((12, 34), (12, 52)):
        stamp(tower, ['.MM.', 'McCM', 'MzzM', 'MzzM', 'MMMM'], wx, wy)
    stamp(tower, ['nnnnnn', 'nNNNNn', 'nNnNNn', 'nNnNkn', 'nNnNNn', 'nNnNNn', 'nnnnnn'], 11, 70)
    # toit conique d'ardoise
    for y in range(8, 24):
        k = (y - 8) / 15
        half = 1 + k * 13.5
        xa, xb = round(14.5 - half), round(15.5 + half)
        for x in range(xa, xb + 1):
            c = 's' if x < xa + 3 else 'M' if x > xb - 3 else 'S'
            if y % 3 == 1 and c == 'S' and x % 3 == 0:
                c = 'M'
            dot(tower, x, y, c)
    hline(tower, 0, 30, 23, 'M')
    hline(tower, 1, 29, 24, 'A')
    # fanion
    vline(tower, 15, 2, 8, 'N')
    fc = ('y', 'Y') if flag == 'gold' else ('E', 'R')
    stamp(tower, [fc[0] * 7, fc[0] * 5 + fc[1] + '.', fc[1] * 5 + '..'] if flag != 'gold'
          else ['yyyyyyy', 'yiyyyY.', 'YYYYY..'], 17, 3)
    tower = finish(tower)
    im.alpha_composite(tower)
    return im


def granary():
    im = canvas(2, 3)
    gable_barn(im, 3, 28, 3, 20, 36, roof='red', wall='woodlight', door=DOOR_HATCH[:3] + ['NZZN'],
               gable_window=False)
    stamp(im, ['kkkk', 'kNNk', 'kNNk'], 14, 12)
    # piliers champignons (pierres) sous le plancher
    hline(im, 3, 28, 37, 'A')
    for sx in (5, 14, 23):
        stamp(im, ['sSSS', '.SM.', '.SM.', '.SM.', 'sSSM'][:5], sx, 39)
    # échelle
    for y in range(30, 46):
        dot(im, 24, y, 'n'); dot(im, 27, y, 'n')
        if y % 3 == 0:
            hline(im, 25, 26, y, 'b')
    return finish(im)


def silo_body(im, x0, x1, ytop, ybot, ladder=True):
    """Silo métallique : cylindre à bandes, dôme, échelle."""
    for y in range(ytop, ybot + 1):
        for x in range(x0, x1 + 1):
            k = (x - x0) / (x1 - x0)
            c = 'W' if k < 0.15 else 's' if k < 0.6 else 'S' if k < 0.88 else 'M'
            if (y - ytop) % 8 == 7:
                c = {'W': 's', 's': 'S', 'S': 'M', 'M': 'M'}[c]
            dot(im, x, y, c)
    # dôme
    w = x1 - x0 + 1
    cx = (x0 + x1) / 2
    for y in range(ytop - w // 3, ytop):
        t = (ytop - y) / (w / 3)
        half = (w / 2) * math.sqrt(max(0.0, 1 - t * t))
        for x in range(round(cx - half), round(cx + half) + 1):
            k = (x - x0) / (x1 - x0)
            dot(im, x, y, 'W' if k < 0.35 else 's' if k < 0.7 else 'S')
    dot(im, round(cx), ytop - w // 3 - 1, 'S')
    if ladder:
        lx = x1 - 4
        for y in range(ytop - 1, ybot - 1):
            dot(im, lx, y, 'x'); dot(im, lx + 2, y, 'x')
            if y % 3 == 0:
                dot(im, lx + 1, y, 'x')
    # porte au pied
    stamp(im, ['MMMM', 'MxxM', 'MxxM', 'MxxM'], x0 + 3, ybot - 3)
    return im


def silo():
    im = canvas(2, 4)
    silo_body(im, 5, 26, 14, 60)
    return finish(im)


def double_silo():
    im = canvas(4, 4)
    silo_body(im, 3, 24, 12, 60)
    silo_body(im, 37, 58, 20, 60)
    # passerelle et tuyau entre les deux
    for x in range(24, 38):
        dot(im, x, 16, 'M'); dot(im, x, 17, 'S')
    vline(im, 30, 17, 40, 'M')
    # petite remise de bois entre les silos
    fill_rect(im, 22, 42, 40, 60, 'woodlight')
    for y in range(36, 42):
        hline(im, 21, 41, y, 'r' if y == 36 else 'R' if y < 40 else 'q')
    hline(im, 22, 40, 42, 'A')
    stamp(im, DOOR_WOOD, 28, 52)
    return finish(im)


def guest_house(level):
    R, ST = R_ROOF, STONE
    if level == 2:
        im = house_grid([
            [R['l'], R['chim'], R['c'], R['r']],
            [R['bl'], R['bc'], R['gable'], R['br']],
            [ST['l'], ST['win'], ST['door'], ST['r']],
        ])
        flowerbox(im, 21, 45, 'pRpRp')
        # enseigne suspendue (lit) et rosiers grimpants
        stamp(im, ['N.....', 'NNNNNN', '.kkkkk', '.kWWsk', '.kRRRk', '.kkkkk'], 50, 30)
        for (x, y) in ((1, 34), (2, 36), (1, 38), (2, 40), (1, 42)):
            dot(im, x + 2, y, 'd'); dot(im, x + 3, y - 1, 'p')
        return im
    im = house_grid([
        [R['l'], R['c'], R['chim'], R['c'], R['r']],
        [R['bl'], R['bc'], R['gable'], R['bc'], R['br']],
        [ST['l'], ST['win'], ST['door'], ST['win'], ST['r']],
    ])
    flowerbox(im, 21, 45, 'pRpRp')
    flowerbox(im, 53, 45, 'PwPwP')
    stamp(im, ['N.....', 'NNNNNN', '.kkkkk', '.kWWsk', '.kRRRk', '.kkkkk'], 66, 30)
    stamp(im, V3_ROWS['awning'][2:6], 36, 32, outline=0) if 'awning' in V3_ROWS else None
    return im


V3_ROWS = {}


def farm_shop():
    """Boutique de la ferme (étal niv. 2, 4 × 2) : auvent rayé, comptoir et cagettes."""
    im = canvas(4, 2)
    for y in range(3, 11):
        for x in range(2, 62):
            fill(im, [(x, y)], 'red', 2, 3)
    hline(im, 2, 61, 3, 'r'); hline(im, 2, 61, 10, 'q')
    fill_rect(im, 3, 11, 60, 29, 'woodlight')
    hline(im, 3, 60, 11, 'A')
    # ouverture du comptoir
    fill_rect(im, 6, 14, 42, 22, 'wood')
    for x in range(6, 43):
        dot(im, x, 14, 'N')
    # étagères avec produits
    for i, c in enumerate('RYGRgYRGY'):
        dot(im, 8 + i * 4, 17, c); dot(im, 9 + i * 4, 17, c)
    hline(im, 6, 42, 19, 'N')
    for i, c in enumerate('yGrYGRyG'):
        dot(im, 9 + i * 4, 20, c)
    # auvent rayé (motif de la v3)
    for x in range(4, 45):
        c = 'R' if (x // 3) % 2 == 0 else 'w'
        for y in range(11, 15):
            dot(im, x, y, c)
        dot(im, x, 15, 'q' if c == 'R' else 's')
    # comptoir
    fill_rect(im, 5, 23, 43, 29, 'barn')
    hline(im, 5, 43, 23, 'k')
    stamp(im, DOOR_WOOD, 49, 20)
    # enseigne (carotte)
    stamp(im, ['kkkkkkkk', 'kkkYYkkk', 'kkYYYYGk', 'kkkYYkGk', 'bbbbbbbb'], 46, 12)
    im = finish(im)
    # cagettes Kenney posées devant
    for i, (c, r) in enumerate(((11, 0), (11, 3), (11, 4))):
        crate = farm(c, r).crop((0, 4, 16, 16))
        paste(im, crate, 2 + i * 14, 20)
    return im


def building_section():
    for level in (1, 2, 3, 4, 5):
        add(f'building.house.{level}', house_level(level))
    add('building.house.5.flag', house_level('flag'))
    add('building.storage.1', granary())
    add('building.storage.2', silo())
    add('building.storage.3', double_silo())
    add('building.guestHouse.2', guest_house(2))
    add('building.guestHouse.3', guest_house(3))
    add('building.stand.2', farm_shop())


# ===========================================================================
# 6. Machines (vues de profil, regard vers la GAUCHE pour le tracteur « .l » ; « .r » = retourné)

def wheel(size, frame=0, rim='Z', hub='y', tire='x'):
    """Roue : pneu sombre, jante, moyeu ; `frame` décale les crampons (animation)."""
    g = Grid(size, size)
    c = (size - 1) / 2
    r = size / 2
    for y in range(size):
        for x in range(size):
            d = math.hypot(x - c, y - c)
            if d <= r - 0.3:
                g.set(x, y, tire if d > r * 0.55 else hub if d < r * 0.28 else rim)
    # crampons
    n = 8 if size >= 10 else 6
    for i in range(n):
        a = 2 * math.pi * (i + 0.5 * frame) / n
        x = round(c + math.cos(a) * (r - 1.2))
        y = round(c + math.sin(a) * (r - 1.2))
        g.set(x, y, 'Z')
    # rayon (montre la rotation)
    a = math.pi / 4 * (1 + frame)
    for t in (0.35, 0.5):
        g.set(round(c + math.cos(a) * r * t), round(c + math.sin(a) * r * t), hub)
    return g.rows()


def tractor(frame=0):
    im = img(32, 32)
    g = Grid(32, 32)
    # capot rouge (à gauche : regard vers la gauche)
    g.rect(3, 13, 17, 20, 'R')
    g.rect(3, 13, 17, 13, 'r')
    g.rect(3, 14, 4, 20, 'r')
    for y in range(15, 20, 2):
        g.rect(5, y, 9, y, 'q')       # grille de calandre
    g.rect(16, 13, 17, 20, 'q')
    # pot d'échappement
    g.rect(12, 6, 13, 12, 'S'); g.set(12, 6, 'M'); g.set(13, 6, 'M')
    # cabine
    g.rect(17, 6, 27, 21, 'R')
    g.rect(18, 7, 26, 7, 'r')
    g.rect(19, 8, 25, 13, 'c')
    g.rect(24, 8, 25, 13, 'C')
    g.rect(17, 5, 28, 6, 'q')          # toit de la cabine
    g.rect(17, 5, 28, 5, 'R')
    g.set(20, 9, 'w')
    # siège et volant
    g.rect(21, 15, 26, 16, 'N')
    # marchepied
    g.rect(15, 21, 22, 21, 'Z')
    rows = g.rows()
    body = art(rows, outline=1, w=32, h=32)
    im.alpha_composite(body)
    # roues : grande à l'arrière (droite), petite à l'avant (gauche)
    big = art(wheel(14, frame), outline=1, w=16, h=16)
    small = art(wheel(9, frame), outline=1, w=16, h=16)
    im.alpha_composite(small, (1, 20))
    im.alpha_composite(big, (16, 16))
    return finish(im, 1)


def trailer():
    """Remorque à foin (attelage du tracteur), 2 × 1, attelée à gauche."""
    im = img(32, 16)
    g = Grid(32, 16)
    g.rect(4, 7, 29, 10, 'b')
    g.rect(4, 7, 29, 7, 'k')
    g.rect(4, 10, 29, 10, 'B')
    g.rect(0, 9, 4, 9, 'N')           # timon
    for x in (8, 16, 24):
        g.rect(x, 4, x, 7, 'n')
    g.rect(5, 2, 28, 6, 'y')
    for x in range(5, 29, 3):
        g.set(x, 3, 'Y'); g.set(x + 1, 5, 'i')
    im.alpha_composite(art(g.rows(), outline=1, w=32, h=16))
    w = art(wheel(7), outline=1, w=16, h=16)
    im.alpha_composite(w.crop((0, 0, 16, 7)), (7, 9))
    im.alpha_composite(w.crop((0, 0, 16, 7)), (19, 9))
    return finish(im, 1)


def seeder(frame=0):
    """Semoir (2 × 1) : trémie verte pleine de graines, socs, roue ; attelage à gauche."""
    im = img(32, 16)
    g = Grid(32, 16)
    g.rect(0, 9, 5, 10, 'N')
    for y in range(1, 10):
        x0, x1 = 5 + (y - 1) // 3, 26 - (y - 1) // 3
        for x in range(x0, x1 + 1):
            g.set(x, y, 'd' if x > x1 - 2 else 'G')
        g.set(x0, y, 'g')
    for x in range(6, 26):
        g.set(x, 1, 'g')
        g.set(x, 2, 'y' if x % 3 else 'Y')
    g.rect(8, 5, 12, 6, 'y'); g.rect(8, 5, 12, 5, 'i')   # étiquette
    for x in (9, 14, 19):
        g.rect(x, 10, x + 1, 11, 'M')
        g.set(x, 12, 'S'); g.set(x + 1, 12, 'S')
    im.alpha_composite(art(g.rows(), outline=1, w=32, h=16))
    wl = art(wheel(8, frame), outline=1, w=16, h=16)
    im.alpha_composite(wl.crop((0, 0, 10, 10)), (21, 6))
    if frame:
        for (x, y) in ((10, 14), (15, 14), (20, 14)):
            dot(im, x, y, 'y')
    return finish(im, 1)


def harvester(frame=0):
    """Moissonneuse-batteuse verte (3 × 2), rabatteur rouge à l'avant (gauche), animé."""
    im = img(48, 32)
    g = Grid(48, 32)
    # corps
    g.rect(14, 10, 42, 24, 'G')
    g.rect(14, 10, 42, 10, 'g')
    g.rect(40, 11, 42, 24, 'd')
    g.rect(14, 24, 42, 24, 'd')
    # cabine vitrée
    g.rect(18, 3, 30, 10, 'G')
    g.rect(19, 4, 29, 9, 'c')
    g.rect(27, 4, 29, 9, 'C')
    g.rect(17, 2, 31, 3, 'd')
    g.rect(17, 2, 31, 2, 'G')
    g.set(20, 5, 'w')
    # vis de déchargement
    g.rect(32, 6, 44, 7, 'y')
    g.rect(32, 8, 44, 8, 'Y')
    # bande jaune
    g.rect(14, 16, 42, 16, 'y')
    # table de coupe (barre)
    g.rect(1, 22, 15, 25, 'S')
    g.rect(1, 22, 15, 22, 'W')
    g.rect(1, 25, 15, 25, 'M')
    for x in range(2, 15, 3):
        g.set(x, 26, 'M')
    rows = g.rows()
    im.alpha_composite(art(rows, outline=1, w=48, h=32))
    # rabatteur (croix de lattes rouges) au-dessus de la table de coupe
    reel = Grid(14, 14)
    c = 6.5
    for b in range(3):
        a = math.radians(frame * 30 + 60 * b)
        for t in range(-6, 7):
            reel.set(round(c + math.cos(a) * t), round(c + math.sin(a) * t), 'R')
    reel.set(6, 6, 'q'); reel.set(7, 7, 'q'); reel.set(6, 7, 'q'); reel.set(7, 6, 'q')
    im.alpha_composite(art(reel.rows(), outline=1, w=16, h=16), (1, 9))
    big = art(wheel(12, frame), outline=1, w=16, h=16)
    small = art(wheel(8, frame), outline=1, w=16, h=16)
    im.alpha_composite(big, (16, 17))
    im.alpha_composite(small.crop((0, 0, 11, 11)), (34, 21))
    return finish(im, 1)


def fruit_picker():
    """Cueilleuse : chariot à échelle et paniers de pommes (2 × 2)."""
    im = img(32, 32)
    g = Grid(32, 32)
    # plateau
    g.rect(3, 21, 28, 24, 'b')
    g.rect(3, 21, 28, 21, 'k')
    g.rect(3, 24, 28, 24, 'B')
    # échelle inclinée
    for y in range(3, 21):
        x = 20 - (y - 3) // 3
        g.set(x, y, 'n'); g.set(x + 4, y, 'n')
        if y % 3 == 0:
            g.rect(x + 1, y, x + 3, y, 'N')
    # paniers de pommes
    for bx in (4, 11):
        g.rect(bx, 15, bx + 5, 20, 'B')
        g.rect(bx, 15, bx + 5, 15, 'b')
        for x in range(bx, bx + 6, 2):
            g.set(x, 17, 'n'); g.set(x + 1, 19, 'n')
        for (dx, dy) in ((1, 13), (3, 13), (2, 12), (4, 14), (0, 14)):
            g.set(bx + dx, dy, 'E' if (dx + dy) % 2 else 'R')
    g.rect(28, 17, 31, 18, 'N')   # timon
    im.alpha_composite(art(g.rows(), outline=1, w=32, h=32))
    wl = art(wheel(8), outline=1, w=16, h=16)
    im.alpha_composite(wl.crop((0, 0, 10, 10)), (4, 21))
    im.alpha_composite(wl.crop((0, 0, 10, 10)), (19, 21))
    return finish(im, 1)


COLLECTOR = [  # collecteur : tapis roulant à œufs qui se déverse dans un panier
    '................',
    '................',
    '................',
    '................',
    '................',
    '.....kk.........',
    '..kk.kbkk.......',
    '..kbkkbkbk......',
    '..SSSSSSSSS.....',
    '..MsMsMsMsM.....',
    '..SSSSSSSSSnbn..',
    '...M.....MnkkkN.',
    '...M.....MNbbbN.',
    '...M......NNNN..',
]


def machine_section():
    add('machine.tractor.l', tractor(0))
    add('machine.tractor.l.1', tractor(1))
    add('machine.tractor.r', flip(tractor(0)))
    add('machine.tractor.r.1', flip(tractor(1)))
    add('machine.trailer.l', trailer())
    add('machine.trailer.r', flip(trailer()))
    add('machine.seeder', seeder(0))
    add('machine.seeder.1', seeder(1))
    add('machine.harvester', harvester(0))
    add('machine.harvester.1', harvester(1))
    add('machine.fruitPicker', fruit_picker())
    add('machine.collector', art(COLLECTOR))


# ===========================================================================
# 7. Friche et terrains : souches, herbes hautes, fleurs sauvages, terre défrichée, panneaux ;
#    pavés (autotuile dérivée du chemin de terre Tiny Town : bords herbeux identiques)

STUMP = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '....kkkkkkk.....',
    '...kbbkkkbbk....',
    '...kbkbbbkbk....',
    '...BkbbbbbkB....',
    '...nBkkkkkBn....',
    '...nnnNnnnnn....',
    '...nNnnnNnnN....',
    '..nnnNnnnnnnn...',
    '.nN.nnNnnNn.Nn..',
    '............N...',
]
TALLGRASS = {
    1: compose([(['.d', 'dG', 'Gg', 'Gg', 'GG'], 3, 6), (['d.', 'Gd', 'gG', 'gG', 'GG', 'Gd'], 6, 4),
                (['.d', 'dG', 'GG', 'Gg', 'GG'], 9, 6), (['d', 'G', 'G', 'G'], 12, 8)]),
    2: compose([(['d.', 'Gd', 'Gg', 'GG'], 2, 8), (['.d', 'dG', 'gG', 'gG', 'Gd', 'GG'], 5, 5),
                (['d.', 'Gd', 'GG', 'GG', 'Gd'], 8, 7), (['.d', 'dG', 'Gg', 'GG', 'GG', 'GG'], 11, 5)]),
    3: compose([(['y', 'G', 'G', 'G'], 3, 7), (['.d', 'dG', 'gG', 'GG', 'GG', 'Gd', 'GG'], 5, 4),
                (['Y', 'd', 'G', 'G', 'G'], 9, 6), (['d.', 'Gd', 'Gg', 'GG', 'GG'], 11, 6)]),
}
WILDFLOWER = {
    1: compose([(['.w.', 'wyw', '.w.'], 3, 4), (['d', 'd', 'd'], 4, 7, False), (['.p.', 'pip', '.p.'], 9, 6),
                (['d', 'd', 'd'], 10, 9, False), (['Gd', 'dG'], 6, 10)]),
    2: compose([(['.P.', 'PyP', '.P.'], 2, 6), (['d', 'd', 'd'], 3, 9, False), (['.y.', 'yiy', '.y.'], 8, 3),
                (['d', 'd', 'd', 'd'], 9, 6, False), (['.c.', 'cwc', '.c.'], 11, 8), (['d', 'd'], 12, 11, False)]),
}
BRAMBLE = [
    '................',
    '................',
    '................',
    '................',
    '.....dd..d......',
    '...dGGdddGd.....',
    '..dGgGRdGgGd....',
    '..GGdGGGdGRGd...',
    '.dGRGdGgGGdGGd..',
    '.GdGGGRdGGGRGG..',
    '.dGGdGGGdGGdGd..',
    '..dGGdGdGdGGd...',
    '...ddNddNdd.....',
]


def cleared_patch():
    """Terre fraîchement défrichée (à poser sur l'herbe) : motte irrégulière, cailloux."""
    g = Grid(16, 16)
    for (x, y) in ellipse_cells(8, 9, 6.6, 4.8):
        g.set(x, y, 'b')
    for (x, y) in ((5, 7), (6, 7), (10, 9), (11, 9), (7, 11), (8, 11), (4, 10)):
        g.set(x, y, 'B')
    for (x, y) in ((9, 6), (6, 10)):
        g.set(x, y, 'k')
    g.set(11, 11, 'S'); g.set(12, 11, 'M')
    return art(g.rows(), outline=1)


def cleared_tile():
    """Terre défrichée pleine (opaque) : même terre que le chemin Tiny Town, mottes et cailloux."""
    t = town(1, 2).copy()
    for (x, y, c) in ((3, 3, 'B'), (4, 3, 'B'), (11, 6, 'B'), (12, 6, 'B'), (6, 10, 'B'), (7, 10, 'n'),
                      (13, 12, 'S'), (14, 12, 'M'), (2, 13, 'B'), (9, 2, 'k'), (10, 13, 'k')):
        dot(t, x, y, c)
    return t


SALE_SIGN = [  # pancarte rouge « à vendre » : lignes de texte et pièce d'or
    '................',
    '................',
    '..EEEEEEEEEEEE..',
    '..EppppppppppE..',
    '..EwwwEwwwwEEE..',
    '..EEEEEEEEEEEE..',
    '..EwwwwwEEyyEE..',
    '..EEEEEEEyiyYE..',
    '..EwwwEEEyyYYE..',
    '..EEEEEEEEYYEE..',
    '..RRRRRRRRRRRR..',
    '......nN........',
    '......nN........',
    '......nN........',
    '.....GnNd.......',
]
FIELD_SIGN = [
    '................',
    '................',
    '................',
    '.kkkkkkkkkkkkkk.',
    '.kbbbbbbbbbbbbk.',
    '.kbbbbbbbbbbbbk.',
    '.kbbbbbbbbbbbbk.',
    '.kbbbbbbbbbbbbk.',
    '.BBBBBBBBBBBBBB.',
    '......nN........',
    '......nN........',
    '......nN........',
    '......nN........',
    '.....GnNd.......',
]
# Petite police 3 × 5 (pour « À VENDRE » sur la grande pancarte)
FONT = {
    'A': ['.w.', 'w.w', 'www', 'w.w', 'w.w'], 'V': ['w.w', 'w.w', 'w.w', 'w.w', '.w.'],
    'E': ['www', 'w..', 'ww.', 'w..', 'www'], 'N': ['w..w', 'ww.w', 'w.ww', 'w..w', 'w..w'],
    'D': ['ww.', 'w.w', 'w.w', 'w.w', 'ww.'], 'R': ['ww.', 'w.w', 'ww.', 'w.w', 'w.w'],
    '1': ['.w', 'ww', '.w', '.w', '.w'], '0': ['www', 'w.w', 'w.w', 'w.w', 'www'],
}


def text_rows(s):
    rows = [''] * 5
    for i, ch in enumerate(s):
        glyph = FONT.get(ch, ['...'] * 5)
        for y in range(5):
            rows[y] += glyph[y] + ('.' if i < len(s) - 1 else '')
    return rows


def big_sale_sign():
    im = img(32, 32)
    g = Grid(32, 32)
    g.rect(2, 3, 29, 20, 'E')
    g.rect(2, 19, 29, 20, 'R')
    g.rect(2, 3, 29, 3, 'p')
    g.stamp([r.replace('.', 'E') for r in text_rows('A')], 14, 6)
    g.set(14, 4, 'w'); g.set(15, 5, 'w')          # accent grave de « À »
    g.stamp([r.replace('.', 'E') for r in text_rows('VENDRE')], 4, 12)
    g.rect(8, 21, 9, 29, 'n'); g.rect(10, 21, 10, 29, 'N')
    g.rect(22, 21, 23, 29, 'n'); g.rect(24, 21, 24, 29, 'N')
    im.alpha_composite(art(g.rows(), w=32, h=32))
    return im


def cobble_pattern():
    """Pavés gris 16 × 16 répétables : rangées décalées, joints sombres, lumière en haut à gauche."""
    t = img(16, 16)
    rows = [(0, 4, [(0, 5), (5, 6), (11, 5)]), (4, 4, [(-2, 5), (3, 6), (9, 5), (14, 5)]),
            (8, 4, [(0, 4), (4, 6), (10, 6)]), (12, 4, [(-3, 5), (2, 5), (7, 5), (12, 5)])]
    for (y0, h, stones) in rows:
        for (x0, w) in stones:
            for dy in range(h):
                for dx in range(w):
                    x = (x0 + dx) % 16
                    y = y0 + dy
                    if dx == w - 1 or dy == h - 1:
                        c = 'M'
                    elif dx == 0 or dy == 0:
                        c = 'W' if dx + dy < 3 else 's'
                    elif dx == w - 2 or dy == h - 2:
                        c = 'S'
                    else:
                        c = 's'
                    t.putpixel((x, y), rgba(c))
    return t


COBBLE = None


def cobble_from_path(c, r, variant=0):
    global COBBLE
    if COBBLE is None:
        COBBLE = cobble_pattern()
    src = town(c, r)
    out = src.copy()
    px = out.load()
    cp = COBBLE.load()
    dirt = {PAL['b'], PAL['B'], PAL['k']}
    for y in range(16):
        for x in range(16):
            p = px[x, y]
            if p[3] and p[:3] in dirt:
                px[x, y] = cp[(x + variant * 5) % 16, (y + variant * 8) % 16]
    return out


def land_section():
    add('land.stump', art(STUMP))
    for k, rows in TALLGRASS.items():
        add(f'land.tallgrass.{k}', art(rows, outline=1))
    for k, rows in WILDFLOWER.items():
        add(f'land.wildflower.{k}', art(rows, outline=1))
    add('land.bramble', art(BRAMBLE))
    add('land.cleared', cleared_tile())
    add('land.cleared.patch', cleared_patch())
    add('land.sale.sign', art(SALE_SIGN))
    add('land.sale.sign.big', big_sale_sign())
    add('land.sign', art(FIELD_SIGN))
    names = {'tl': (0, 1), 't': (1, 1), 'tr': (2, 1), 'l': (0, 2), 'c': (1, 2), 'r': (2, 2),
             'bl': (0, 3), 'b': (1, 3), 'br': (2, 3),
             'inner.tl': (3, 3), 'inner.tr': (4, 3), 'inner.br': (5, 3), 'inner.bl': (6, 3)}
    for n, (c, r) in names.items():
        add(f'ground.cobble.{n}', cobble_from_path(c, r))
    add('ground.cobble.c.2', cobble_from_path(1, 2, 1))


# ===========================================================================
# 8. Produits, bulle de ramassage

TRUFFLE = [
    '................',
    '................',
    '................',
    '................',
    '......nnN.......',
    '....nnNNnnN.....',
    '...nNnNNNnNN....',
    '...NnNNHNNnN....',
    '..nNNHNNNHNNN...',
    '..NnNNNHNNNHN...',
    '..NNHNNNNHNNH...',
    '...NNNHNNNNH....',
    '....HHNNHHH.....',
    '......HHH.......',
]
EGGS = [  # panier d'œufs
    '................',
    '................',
    '................',
    '................',
    '....kk.kk.......',
    '...kkbkkbkk.....',
    '...kbkkbkkb.....',
    '..nnnnnnnnnnn...',
    '..nbnbnbnbnbn...',
    '..bnbnbnbnbnb...',
    '..nbnbnbnbnbn...',
    '...BBBBBBBBB....',
]
ANGORA = [  # pelote de laine angora
    '................',
    '................',
    '................',
    '.....wWWw.......',
    '...wWwwwWww.....',
    '..wwWwLwwWWw....',
    '..WwwwwwLwwW....',
    '..wwLwwwwwwws...',
    '..WwwwWwwLwws...',
    '..wwwwwLwwwss...',
    '...swwwwwwss.L..',
    '....sssssss.L.L.',
    '.............L..',
]
MILK_CAN = [
    '................',
    '................',
    '.....SSSS.......',
    '....SWsssS......',
    '.....SssS.......',
    '....SWsssS......',
    '...SWssssSM.....',
    '...SWwwwsSM.....',
    '...SWcccsSM.....',
    '...SWwwwsSM.....',
    '...SWssssSM.....',
    '...SWssssSM.....',
    '....MMMMMM......',
]
DUCK_EGG = [
    '................',
    '................',
    '................',
    '.......ccc......',
    '......cwwcc.....',
    '.....cwwcccc....',
    '.....cwccccC....',
    '....ccccccccC...',
    '....cccccccCC...',
    '....ccccccCCC...',
    '.....cccCCCC....',
    '......CCCCC.....',
]
TICKET = [  # billet de balade à cheval
    '................',
    '................',
    '................',
    '................',
    '.yyyyyyyyyyyyyy.',
    '.yiiiiYiiiiiiiy.',
    '.yiNNiYiiiiiiiy.',
    '..iNiNYiRRRRii..',
    '..iNiNYiiiiiii..',
    '.yiNiNYiRRRiiiy.',
    '.yiiiiYiiiiiiiy.',
    '.YYYYYYYYYYYYYY.',
]
FISH = {
    1: ['................', '................', '................', '................', '................',
        '...........c....', '....ccccc.cc....', '...cwccZcccc....', '..cwcccccccC....', '...cCCCCC.CC....',
        '....CCCC...C....'],
    2: ['................', '................', '................', '................', '..........yY....',
        '....yyyyy.yy....', '...yiyyZyyyy....', '..yiyYyYyyyY....', '..yyyyyyyyYY....', '...YYYYYY.YY....',
        '....YYYY...Y....'],
    3: ['................', '................', '................', '...........S....', '.....SSSS.SS....',
        '...SWsssSSsS....', '..SWssZssssS....', '.SWsMsMsMsSSS...', '..SsssssssSSS...', '...MSSSSSS.MS...',
        '.....MMMM...M...'],
}


def bubble_frame():
    """Cadre de bulle 16 × 16, à étirer en 9 tranches (bords de 5 px)."""
    g = Grid(16, 16)
    g.rect(2, 1, 13, 14, 'w')
    g.rect(1, 2, 14, 13, 'w')
    g.rect(2, 13, 13, 13, 'W'); g.rect(13, 2, 13, 13, 'W')
    g.rect(1, 13, 1, 13, '.'); g.rect(14, 13, 14, 13, '.')
    return art(g.rows(), outline=1)


def bubble_tail():
    g = Grid(16, 16)
    g.stamp(['wwwww', '.wwW.', '..w..'], 5, 0)
    im = art(['.' * 16] + g.rows()[:-1], outline=1)
    return im


def bubble_collect():
    """Bulle complète 32 × 32 (queue en bas au centre) : contenu 16 × 16 en (8, 4)."""
    g = Grid(32, 32)
    for (x, y) in ellipse_cells(15.5, 12, 13.6, 10.8):
        g.set(x, y, 'w')
    g.rect(3, 6, 28, 18, 'w')
    for y in range(18, 23):
        for x in range(4, 28):
            if (x, y) in ellipse_cells(15.5, 12, 13.6, 10.8):
                g.set(x, y, 'W' if y > 19 else 'w')
    g.stamp(['wwwwww', '.wwwW.', '..wW..', '...W..'], 13, 22)
    return art(g.rows(), outline=2, w=32, h=32)


def product_section():
    add('product.truffle', art(TRUFFLE))
    add('product.eggs', art(EGGS))
    add('product.angora', art(ANGORA))
    add('product.milk', art(MILK_CAN))
    add('product.duckEgg', art(DUCK_EGG))
    add('product.ride', art(TICKET))
    add('bubble', bubble_frame())
    add('bubble.tail', bubble_tail())
    add('bubble.collect', bubble_collect())


def fish_section():
    for k, rows in FISH.items():
        add(f'product.fish.{k}', art(rows))


# ===========================================================================
# 9. Décor de fêtes

def bunting(frame=0):
    g = Grid(32, 16)
    for x in range(32):
        y = 3 + round(2 * math.sin(math.pi * x / 32))
        g.set(x, y, 'N')
    cols = 'EyCGEyCG'
    for i in range(4):
        x0 = 2 + i * 8
        y0 = 4 + round(2 * math.sin(math.pi * (x0 + 2) / 32))
        c = cols[i + frame]
        for dy in range(5):
            for dx in range(dy // 2, 5 - dy // 2):
                g.set(x0 + dx, y0 + dy, c)
    return art(g.rows(), outline=1, w=32, h=16)


def lanterns(frame=0):
    g = Grid(32, 16)
    for x in range(32):
        g.set(x, 2 + round(2 * math.sin(math.pi * x / 32)), 'N')
    for i, c in enumerate('ERyE' if frame == 0 else 'RyER'):
        x0 = 3 + i * 7
        y0 = 4 + round(2 * math.sin(math.pi * (x0 + 2) / 32))
        g.stamp(['.N.', c * 3, (c * 2) + 'q', c * 3, '.N.'] if c != 'y'
                else ['.N.', 'iyy', 'yyY', 'yyY', '.N.'], x0, y0)
        g.set(x0, y0 + 1, 'i' if c != 'y' else 'w')
    return art(g.rows(), outline=1, w=32, h=16)


def fair_stand():
    """Stand de foire rayé (2 × 2) : auvent, comptoir de bonbons et de pommes d'amour."""
    im = img(32, 32)
    g = Grid(32, 32)
    for x in range(2, 30):
        c = 'E' if (x // 3) % 2 == 0 else 'w'
        for y in range(4, 9):
            g.set(x, y, c)
        g.set(x, 9, 'q' if c == 'E' else 's')
        if x % 3 == 1:
            g.set(x, 10, 'q' if c == 'E' else 's')
    g.rect(3, 3, 28, 3, 'R')
    for x in (4, 27):
        g.rect(x, 10, x, 29, 'n')
    g.rect(3, 20, 28, 28, 'b')
    g.rect(3, 20, 28, 20, 'k')
    g.rect(3, 28, 28, 28, 'B')
    for i in range(5):
        g.rect(4 + i * 5, 23, 5 + i * 5, 25, 'E' if i % 2 else 'P')
    for i, c in enumerate('ERERE'):
        g.stamp(['.n.', c + c + c, c + c + 'q'], 6 + i * 4, 15)
    return art(g.rows(), outline=2, w=32, h=32)


XMAS_TREE = [
    '................',
    '.......y........',
    '......yiy.......',
    '.......d........',
    '......dGd.......',
    '.....dGEGd......',
    '......dGd.......',
    '.....dGGGd......',
    '....dGyGGGd.....',
    '.....dGGCd......',
    '....dGGGGGd.....',
    '...dGEGGGyGd....',
    '....dGGGGGd.....',
    '...dGGGCGGGd....',
    '..dGyGGGGGEGd...',
    '...dGGGGGGGd....',
    '..dGGGEGGGGGd...',
    '.dGCGGGGGyGGGd..',
    '..ddddddddddd...',
    '......nN........',
    '....RRRRRR......',
    '....RqRRqR......',
    '....qqqqqq......',
]


def chalet(frame=0):
    """Chalet du marché de Noël (3 × 2) : toit enneigé, guirlande lumineuse, étal de bredele."""
    im = img(48, 32)
    g = Grid(48, 32)
    for y in range(2, 11):
        k = (y - 2)
        g.rect(2 + max(0, 6 - k), y, 45 - max(0, 6 - k), y, 'n' if y > 6 else 'N')
    for y in range(2, 7):
        g.rect(2 + max(0, 6 - (y - 2)) + 1, y, 45 - max(0, 6 - (y - 2)) - 1, y, 'W' if y < 5 else 'w')
    g.rect(2, 7, 45, 8, 'W')
    g.rect(4, 11, 43, 29, 'n')
    for x in range(4, 44, 4):
        g.rect(x, 11, x, 29, 'N')
    g.rect(8, 14, 39, 22, 'N')
    g.rect(9, 15, 38, 21, 'I')
    g.rect(6, 23, 41, 29, 'b')
    g.rect(6, 23, 41, 23, 'k')
    for i in range(7):
        g.set(10 + i * 4, 19, 'y'); g.set(11 + i * 4, 19, 'Y')
        g.set(10 + i * 4, 17, 'E')
    # guirlande lumineuse sous le toit
    for i in range(20):
        x = 4 + i * 2
        g.set(x, 11, ('yEcG' if frame == 0 else 'EcGy')[i % 4])
    return art(g.rows(), outline=2, w=48, h=32)


ROSETTE = [
    '................',
    '.....CCCCC......',
    '....CccccuC.....',
    '...CcwwwwcuC....',
    '...CcwyyYwcC....',
    '...CcwyYYwcC....',
    '...CcwwwwcuC....',
    '....CcccuuC.....',
    '.....CCCCC......',
    '.....RR.EE......',
    '.....RR.EE......',
    '....RR...EE.....',
    '....R.....E.....',
]
BALLOONS = [
    '................',
    '...EE....CC.....',
    '..EiEE..CcCC....',
    '..EEEE..CCCC....',
    '..EEEq..CCCu....',
    '...Eq....Cu.....',
    '....N...N.......',
    '....N..yy.......',
    '.....NyiyY......',
    '.....NyyyY......',
    '......NyY.......',
    '.......N........',
    '.......N........',
    '......N.........',
    '......N.........',
    '.......N........',
    '.......N........',
    '......N.........',
    '......N.........',
    '.....nNn........',
]


def pumpkin_display():
    """Présentoir de citrouilles sur bottes de foin (2 × 1)."""
    im = img(32, 16)
    g = Grid(32, 16)
    g.rect(2, 9, 29, 13, 'y')
    for x in range(2, 30, 3):
        g.set(x, 10, 'Y'); g.set(x + 1, 12, 'i')
    g.rect(2, 13, 29, 13, 'o')
    g.rect(15, 9, 15, 13, 'o')
    for (x0, y0) in ((4, 3), (13, 2), (21, 4)):
        g.stamp(['..d...', '.YyYy.', 'YyYyYY', 'YyYyYo', '.YoYo.'], x0, y0)
    return art(g.rows(), outline=2, w=32, h=16)


def fair_section():
    add('fair.bunting', bunting(0))
    add('fair.bunting.1', bunting(1))
    add('fair.lanterns', lanterns(0))
    add('fair.lanterns.1', lanterns(1))
    add('fair.stand', fair_stand())
    add('fair.xmasTree', art(XMAS_TREE, w=16, h=32))
    add('fair.chalet', chalet(0))
    add('fair.chalet.1', chalet(1))
    add('fair.ribbon', art(ROSETTE))
    add('fair.balloons', art(BALLOONS, w=16, h=32))
    add('fair.pumpkins', pumpkin_display())


# ===========================================================================
# 10. Icônes d'interface de la carrière (16 × 16, contour de 2 px comme les icônes v3)

ICONS = {
    # terrain : parcelle de terre labourée avec un petit panneau
    'land': [
        '................', '................', '..........k.....', '.........kkk....',
        '.........kkk....', '..........n.....', '..GGGGGGGGnGG...', '.GbBbBbBbBbBbG..',
        '.GbbbbbbbbbbbG..', '.GBbBbBbBbBbBG..', '.GbbbbbbbbbbbG..', '.GbBbBbBbBbBbG..',
        '..GGGGGGGGGGG...',
    ],
    # carte : plan plié, chemin pointillé et croix
    'map': [
        '................', '................', '..kkkklllkkkk...', '..kGGklllkkkk...',
        '..kGGkllRlRkk...', '..kkkkll.R.kk...', '..kkRklRlRkkk...', '..kR.klllkkGk...',
        '..kkRklllkGGk...', '..kkkklGGkkkk...', '..kkkklGGkkkk...', '..kkkklllkkkk...',
    ],
    # plan de culture : écritoire avec pousse
    'plan': [
        '................', '.....NNNN.......', '..bbbSMMSbbb....', '..bwwwwwwwwb....',
        '..bwGwwwwwwb....', '..bwddwsssswb...', '..bwwwwwwwwb....', '..bwGwwwwwwb....',
        '..bwddwsssswb...', '..bwwwwwwwwb....', '..bwwwwwwwwb....', '..bbbbbbbbbb....',
    ],
    # équipe : deux têtes (chapeau de paille et cheveux)
    'staff': [
        '................', '................', '...kkkk.........', '..kBBBBk..nnn...',
        '.kkRRRRkk.nnnn..', '..ffZfZ...fZfZ..', '..fffff...ffff..', '.rrxrxrr.PPxPP..',
        '.rrxxxrr.PPxxP..', '.rrxxxrr.PPxxP..', '.rrxxxrr.PPxxP..',
    ],
    'job.gardener': [  # arrosoir et pousse
        '................', '................', '..........d.....', '.........dGd....',
        '.....SSS..d.....', '....S...S.d.....', '...MsssssMsss...', '...MsssssssM....',
        '...MSSSSSSM.....', '...MSSSSSSM.....', '....MMMMMM......',
    ],
    'job.keeper': [  # œuf et panier
        '................', '................', '......kk........', '.....kkkb.......',
        '....kkkkbb......', '....kkkkbb......', '..nnnnnnnnnnn...', '..nbnbnbnbnbn...',
        '..bnbnbnbnbnb...', '..nbnbnbnbnbn...', '...BBBBBBBBB....',
    ],
    'job.artisan': [  # pot de confiture et cuillère
        '................', '................', '...RwRwRwR......', '...wRwRwRw..S...',
        '....yyyyy...S...', '...qRRRRRq..S...', '...qRkkRRq..S...', '...qRkRRRq.SSS..',
        '...qRRRRRq.SSS..', '...qRRRRRq......', '....qqqqq.......',
    ],
    'job.seller': [  # bourse de pièces
        '................', '................', '......nN........', '.....b.nb.......',
        '....bbnnbb......', '...bbbbbbbb.....', '..bbbyybbbBB....', '..bbyiyYbbBB....',
        '..bbbyYbbbBB....', '..bbbbbbbbBB....', '...BBBBBBBB.....',
    ],
    'trait.strong': [  # haltère
        '................', '................', '................', '..MM......MM....',
        '..MSM....MSM....', '.MSSMSSSSMSSM...', '.MSSMWWWWMSSM...', '.MSSMSSSSMSSM...',
        '..MSM....MSM....', '..MM......MM....',
    ],
    'trait.thrifty': [  # tirelire cochon
        '................', '................', '......YY........', '......yY........',
        '...KKKKKKK.K....', '..KKKKKKKKKK....', '.LKKKKKKKZKKO...', '..KKKKKKKKKKO...',
        '..LKKKKKKKKK....', '...LLLLLLLL.....', '...L.L..L.L.....',
    ],
    'trait.quick': [  # éclair
        '................', '.......yyyy.....', '......yyyY......', '.....yiyY.......',
        '....yiyY........', '...yiyyyyyy.....', '.....yyyyY......', '.....yyyY.......',
        '....yyYY........', '....yyY.........', '...yY...........',
    ],
    'trait.loyal': [  # cœur avec ruban (fidèle)
        '................', '................', '...RR...RR......', '..RrrR.RrrR.....',
        '..RrwRRRRRR.....', '..RrRRRRRRq.....', '...RRRRRRq......', '....RRRRq.......',
        '.....RRq........', '....CC.CC.......', '...CC...CC......',
    ],
    'trait.animalLover': [  # empreinte de patte
        '................', '................', '...bb.....bb....', '...bb.bb..bb....',
        '......bb........', '..bb......bb....', '..bb.bbbb.bb....', '.....bbbbb......',
        '....bbbbbbb.....', '....bbbbbbB.....', '.....BBBBB......',
    ],
    'trait.chatty': [  # bulle de parole
        '................', '................', '...wwwwwwwww....', '..wwwwwwwwwwW...',
        '..wwZwwZwwZwW...', '..wwwwwwwwwwW...', '...WWWwwwWWW....', '......wwW.......',
        '.....wW.........',
    ],
    'trait.earlyBird': [  # soleil levant sur l'horizon
        '................', '................', '.......y........', '..y....y....y...',
        '....y.yyy.y.....', '.....yyiyy......', '...yyyiiiyyy....', '..yyyyiiiyyyy...',
        '.GGGGGGGGGGGGGG.', '.dddddddddddddd.',
    ],
    'mood.joyful': [
        '................', '.....yyyyy......', '...yyyyyyyyy....', '..yyiyyyyyyyY...',
        '..yyZZyyyZZyY...', '..yyyyyyyyyyY...', '..yZZZZZZZZyY...', '..yyZqqqqZyyY...',
        '..yyyZZZZyyyY...', '...YyyyyyyyY....', '.....YYYYY......',
    ],
    'mood.content': [
        '................', '.....yyyyy......', '...yyyyyyyyy....', '..yyiyyyyyyyY...',
        '..yyyZyyyZyyY...', '..yyyZyyyZyyY...', '..yyyyyyyyyyY...', '..yyZyyyyyZyY...',
        '..yyyZZZZZyyY...', '...YyyyyyyyY....', '.....YYYYY......',
    ],
    'mood.tired': [
        '...........ww...', '.....yyyyy..w...', '...yyyyyyy.ww...', '..yyiyyyyyyyY...',
        '..yyyyyyyyyyY...', '..yyZZyyZZyyY...', '..yyyyyyyyyyY...', '..yyyyyyyyyyY...',
        '..yyyyZZZyyyY...', '...YyyyyyyyY....', '.....YYYYY......',
    ],
    'quest': [  # parchemin avec point d'exclamation
        '................', '..kkkkkkkkkk....', '.kbkkkkkkkkbk...', '..kkkkRRkkkk....',
        '..kkkkRRkkkk....', '..kkkkRRkkkk....', '..kkkkRRkkkk....', '..kkkkkkkkkk....',
        '..kkkkRRkkkk....', '..kkkkkkkkkk....', '.kbkkkkkkkkbk...', '..bbbbbbbbbb....',
    ],
    'heart': [
        '................', '................', '..RRR...RRR.....', '.RrwrR.RrrrR....',
        '.RwrrRRRrrrq....', '.RrrrrrrrrRq....', '..RrrrrrrRq.....', '...RrrrrRq......',
        '....RrrRq.......', '.....RRq........', '......q.........',
    ],
    'heart.empty': [
        '................', '................', '..SSS...SSS.....', '.S...S.S...S....',
        '.S....S....M....', '.S.........M....', '..S.......M.....', '...S.....M......',
        '....S...M.......', '.....S.M........', '......M.........',
    ],
    'calendar': [  # agenda
        '................', '....N....N......', '..RRNRRRRNRR....', '..RRRRRRRRRR....',
        '..wwwwwwwwww....', '..wZwZwZwZww....', '..wwwwwwwwww....', '..wZwZwRRZww....',
        '..wwwwwRRwww....', '..wZwZwZwwww....', '..wwwwwwwwwW....', '..WWWWWWWWWW....',
    ],
    'storage': [  # grenier : sac de grain
        '................', '.....kbbk.......', '......bb........', '....kkkkbb......',
        '...kkkkkkbb.....', '..kkkkkkkkbb....', '..kkkyykkkbb....', '..kkyYYykkbB....',
        '..kkkyykkkbB....', '..kkkkkkkbBB....', '...bbbbbbBB.....',
    ],
    'wage': [  # salaire : pièces et flèche
        '................', '................', '....yyyy........', '...yiiyyY.......',
        '...yyyyYY.......', '...YyyyYY.......', '....YYYY.yyyy...', '........yiiyyY..',
        '....yyyyyyyyYY..', '...yiiyyYYyyYY..', '...yyyyYY.YYY...', '....YYYY........',
    ],
    'market.up': [
        '................', '.......G........', '......GgG.......', '.....GgggG......',
        '....GgggggG.....', '...GGGggGGGG....', '.....GggG.......', '.....GggG.......',
        '.....GggG.......', '.....GGGG.......',
    ],
    'market.down': [
        '................', '.....RRRR.......', '.....RrrR.......', '.....RrrR.......',
        '.....RrrR.......', '...RRRrrRRRR....', '....RrrrrrR.....', '.....RrrrR......',
        '......RrR.......', '.......R........',
    ],
    'greenhouse': [
        '................', '.......S........', '......ScS.......', '.....ScccS......',
        '....ScScScS.....', '...ScccScccS....', '..SSSSSSSSSSS...', '..ScccScccScS...',
        '..ScGcScGcScS...', '..SdGdSdGdSdS...', '..SSSSSSSSSSS...',
    ],
    'event': [  # cotillons
        '................', '..y....E...C....', '...E.C....y.....', '.C.....y.......y',
        '......E....C....', '....yyy.E.......', '...yyiyy........', '..yyyyYy.C......',
        '..RyRyRY........', '..RqRqRq........', '...qqqq.........',
    ],
    'fuel': [  # jerrican
        '................', '......SSS.......', '.....SS.SRRRR...', '....RRRRRrrrR...',
        '....RrrrrrrrRq..', '....RrRrrrRrRq..', '....RrrRrRrrRq..', '....RrrrRrrrRq..',
        '....RrrRrRrrRq..', '....RrRrrrRrRq..', '....RqqqqqqqRq..', '.....qqqqqqqq...',
    ],
    'house': [
        '................', '.......R........', '......RrR.......', '.....RrrrR..S...',
        '....RrrrrrR.S...', '...RRRRRRRRRR...', '....bbbbbbbb....', '....bccbNNbb....',
        '....bzzbNNbb....', '....bbbbNkbb....', '....bbbbNNbb....', '....BBBBBBBB....',
    ],
    'leave': [  # congé : hamac entre deux arbres
        '................', '..GGG.....GGG...', '.GgGGG...GgGGG..', '..GGd.....dGG...',
        '...n.......n....', '...n.......n....', '...nRr...rRn....', '...n.RrrrR.n....',
        '...n..RRR..n....', '...n.......n....', '..GnG.....GnG...',
    ],
    'level': [  # niveau : chevrons
        '................', '.......y........', '......yiy.......', '.....yiyyY......',
        '....yyY.yyY.....', '...yY..y..yY....', '......yiy.......', '.....yiyyY......',
        '....yyY.yyY.....', '...yY.....yY....',
    ],
    'hire': [  # embaucher : tête + « + »
        '................', '................', '...kkkk.........', '..kBBBBk........',
        '.kkRRRRkk..GG...', '..ffZfZ...GggG..', '..fffff..GGggGG.', '.rrxrxrr.GGggGG.',
        '.rrxxxrr..GggG..', '.rrxxxrr...GG...', '.rrxxxrr........',
    ],
    'patrimony': [  # patrimoine : maison et sac d'écus
        '................', '....R...........', '...RrR..........', '..RrrrR.........',
        '.RRRRRRR........', '..bbNbb..nN.....', '..bbNbb.b.nb....', '..bbbbb.bbnnbb..',
        '.......bbyybbB..', '.......byiyYbB..', '.......bbyYbbB..', '........BBBBB...',
    ],
    'crow': [
        '................', '................', '.......zzz......', '......zzwzy.....',
        '......zzzzYy....', '..Z..zzzzz......', '..ZZzzzxzzz.....', '...ZZzxxzzZ.....',
        '....ZZZzzZ......', '......Y.Y.......', '......YY.YY.....',
    ],
    'fishing': [  # canne à pêche et poisson
        '...........n....', '..........n.....', '.........n......', '........n.....S.',
        '.......n......S.', '......n.......S.', '.....n........S.', '....n.....c...S.',
        '...n....ccccc.S.', '..n....cwcZcccS.', '.......cccccCc..', '........CCCC.C..',
    ],
    'visitor': [  # villageoise au panier
        '................', '.....WWW........', '....WWWWs.......', '....SSSSS.......',
        '....SZSZS.......', '....SSSSS.......', '...PPPwPPP......', '..SPPPPPPPS.....',
        '..SPPPPPPPn.nn..', '...PPPPPP.nbbn..', '...PPPPPP..bb...', '....F..F........',
    ],
    'contest': [  # cocarde du comice
        '................', '.....CCCCC......', '....CccccuC.....', '...CcwwwwcuC....',
        '...CcwyyYwcC....', '...CcwyYYwcC....', '...CcwwwwcuC....', '....CcccuuC.....',
        '.....CCCCC......', '.....RR.EE......', '....RR...EE.....',
    ],
    'rainbow': [
        '................', '................', '....EEEEEE......', '..EEyyyyyyEE....',
        '.EyyGGGGGGyyE...', '.EyGGCCCCGGyE...', 'EyGCCw..wCCGyE..', 'EyGC......CGyE..',
        'EyGC......CGyE..',
    ],
    'lock': [
        '................', '................', '.....SSSS.......', '....S....S......',
        '....S....S......', '...yyyyyyyy.....', '...yiyyyyyY.....', '...yyyNNyyY.....',
        '...yyyNNyyY.....', '...yyyyyyyY.....', '....YYYYYY......',
    ],
    'coins': [
        '................', '................', '.....yyyy.......', '....yiiyyY......',
        '....yyyyYY......', '...yyyyyyY......', '..yiiyyYYY......', '..yyyyYYYyyyy...',
        '..YyyyYYyiiyyY..', '...YYYY.yyyyYY..', '........YyyyYY..', '.........YYYY...',
    ],
}

# Icônes des machines (miniatures)
MACHINE_ICONS = {
    'tractor': [
        '................', '................', '........RRRR....', '........RccR....',
        '....S...RccR....', '...RRRRRRRRRR...', '...RqRqRRRRRR...', '...RRRRRRRRRR...',
        '..xxx...xxxxx...', '.xxyxx.xxxyxxx..', '..xxx..xxyyyxx..', '.......xxxyxxx..',
        '........xxxxx...',
    ],
    'seeder': [
        '................', '................', '..GGGGGGGGGG....', '..GyyyyyyyyG....',
        '...GGGGGGGGd....', '....GGGGGGd.....', '.....GGGGd......', '..NNNNNNNNNNN...',
        '...M..M..M.xx...', '...S..S..Sxyx...', '...........x....',
    ],
    'harvester': [
        '................', '.......GGGG.....', '.......GccG.....', '.....GGGGGGGGyy.',
        '.R.R.GGGGGGGGd..', '..R..GyyyyyyGd..', '.R.R.GGGGGGGGd..', 'SSSSSSxxxGGGGd..',
        '.....xxyxx.xx...', '.....xxyxx.xyx..', '......xxx..xx...',
    ],
    'fruitPicker': [
        '................', '.........n..n...', '.........nNNn...', '..........n..n..',
        '...RE.....nNNn..', '..REER.....n..n.', '..RERE.....nNNn.', '..BBBBBB...n..n.',
        '..BnBnBB.bbbbbb.', '..BBBBBBbbbbbbb.', '...x.......x....', '..xyx.....xyx...',
    ],
    'collector': COLLECTOR,
    'sprinklers': [
        '................', '..c...c...c.....', '...c..c..c......', '.c..c.c.c..c....',
        '...c.....c......', '.....SSS........', '....SWSSM.......', '.....SSM........',
        '......S.........', '......S.........', '....GGSGG.......', '...GGGGGGG......',
    ],
    'waterTower': [
        '................', '.....RRRR.......', '....RrrrrR......', '...SWsssssS.....',
        '...SWccsssS.....', '...SWsssssS.....', '...SSSSSSSS.....', '....n....n......',
        '....nn..nn......', '....n.nn.n......', '....n.nn.n......', '...nn....nn.....',
    ],
    'conveyor': [
        '................', '................', '................', '.......bbbb.....',
        '.......bkkb.....', '.......bbbb.....', '..SSSSSSSSSSSS..', '..MsMsMsMsMsMM..',
        '..SSSSSSSSSSSS..', '...M........M...', '...M........M...',
    ],
}


def shield(rank):
    """Blason de rang : écu (bronze → or, puis violet et rouge royal) avec des épis / une couronne."""
    colors = {1: ('b', 'B', 'n'), 2: ('s', 'S', 'M'), 3: ('y', 'Y', 'o'),
              4: ('G', 'd', 'D'), 5: ('P', 'Q', 'Q'), 6: ('E', 'R', 'q')}[rank]
    light, mid, dark = colors
    g = Grid(16, 16)
    for y in range(2, 14):
        half = 5 if y < 9 else 5 - (y - 8)
        for x in range(8 - half - 1, 8 + half):
            g.set(x, y, light if x < 7 else mid)
    g.rect(2, 2, 12, 2, dark)
    # épis de blé (1 à 5) ; couronne pour le Domaine
    if rank < 6:
        pos = {1: [7], 2: [5, 9], 3: [4, 7, 10], 4: [4, 6, 8, 10], 5: [3, 5, 7, 9, 11]}[rank]
        for x in pos:
            for y in (5, 6, 7, 8):
                g.set(x, y, 'i' if y < 7 else 'y')
            g.set(x, 9, 'o')
    else:
        g.stamp(['y.y.y', 'yyyyy', 'yiyiY', 'YYYYY'], 5, 5)
    return art(g.rows())


# Succès : médaillon doré commun + motif
ACH_MOTIF = {
    'careerStart': ['..SS..', '.SWsS.', 'SWssSM', 'SsssSM', '.SMMM.'],       # première pierre
    'firstLot': ['.....y', '.bb.yy', 'bBbB.y', 'bbbbGG', 'BbBbGG', '.GGGG.'],
    'rank3': ['y.y.y.', 'y.y.y.', 'i.i.i.', 'y.y.y.', 'o.o.o.'],
    'rank6': ['y.y.y', 'yyyyy', 'yiyiY', 'YYYYY'],
    'firstHire': ['.ff..', 'fZfZ.', 'fffGG', 'rxrGG', 'rxr..'],
    'fullTeam': ['.f..f.', 'fZffZf', 'rxrrxr', 'rxrrxr'],
    'teamLeader': ['..y...', '.yiy..', '..f...', '.fZf..', 'rrxrr.', 'rrxrr.'],
    'firstMachine': ['..SS..', '.SWWS.', 'SWMMWS', 'SWMMWS', '.SWWS.', '..SS..'],
    'tractor': ['...RR.', '...Rc.', '.RRRRR', 'xx.xxx', 'xy.xyx'],
    'winterTomato': ['..G..c', '.RGR.c', 'RrRRR.', 'RRRRq.', '.RRq..'],
    'menagerie': ['KK.ww.', 'KZ.wZ.', 'bb.yy.', 'bZ.yR.'],
    'truffles': ['..nN..', '.nNnN.', 'nNHNNN', 'NNNHNN', '.HNNH.'],
    'josephFriend': ['RR.RR.', 'RrRrR.', 'RrrrR.', '.RrR..', '..R...'],
    'fairChampion': ['.CCC.', 'CyyYC', 'CyYYC', '.CCC.', 'R.E..', 'R..E.'],
    'tenYears': ['.w.www', 'ww.w.w', '.w.w.w', '.w.w.w', '.w.www'],
    'fullSilo': ['.ss.', 'sWsS', 'sWsS', 'sWsS', 'sWsS', 'SSSS'],
    'recordYear': ['....G.', '...GG.', '.G.G..', 'GGG...', 'y.....', 'yiY...'],
}


def ach_icon(motif):
    g = Grid(16, 16)
    for (x, y) in ellipse_cells(8, 8, 6.4, 6.4):
        g.set(x, y, 'y')
    for (x, y) in ellipse_cells(8, 8, 5.0, 5.0):
        g.set(x, y, 'k')
    for (x, y) in ellipse_cells(8, 8, 6.4, 6.4):
        if x > 8 and y > 8 and g.get(x, y) == 'y':
            g.set(x, y, 'Y')
    rows = g.rows()
    h = len(motif)
    w = max(len(r) for r in motif)
    rows = compose([(rows, 0, 0, False), (motif, 8 - w // 2, 8 - h // 2 + (1 if h < 6 else 0))])
    return art(rows)


def icon_section():
    for name, rows in ICONS.items():
        add(f'icon.career.{name}', art(rows))
    for name, rows in MACHINE_ICONS.items():
        add(f'icon.career.machine.{name}', art(rows))
    for r in range(1, 7):
        add(f'icon.career.rank.{r}', shield(r))
    for aid, motif in ACH_MOTIF.items():
        im = ach_icon(motif)
        add(f'icon.ach.{aid}', im)
        add(f'icon.ach.{aid}.locked', gray(im))


# ===========================================================================
# Placement dans la planche, écriture du PNG et du bloc de src/render/atlas.js

PHASE_A = [people_section, portrait_section, animal_section, shelter_section, building_section,
           machine_section, land_section, product_section, fair_section, icon_section]
PHASE_B = []   # complété plus bas (section « Phase B »)


def pack():
    """Premier emplacement libre (lecture ligne par ligne) pour chaque sprite, SHEET_COLS tuiles de large.
    Les grands sprites sont placés d'abord (planche plus compacte), l'ordre reste déterministe."""
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
    return f"{{ sheet: 'career', col: {c}, row: {r}" + (f', w: {w}, h: {h}' if (w, h) != (1, 1) else '') + ' }'


JS_HELPERS = r'''
/** Apparences des employés : genre ('m' | 'f') × tenue (0..3) × chapeau (0 | 1) × teinte (0..3). */
export const STAFF_GENDERS = Object.freeze(['m', 'f']);
export const STAFF_OUTFITS = 4;
export const STAFF_TINTS = 4; // 0 cheveux bruns / peau médiane · 1 blonds / claire · 2 auburn / hâlée · 3 noirs / foncée
export const STAFF_POSES = Object.freeze(['idle', 'walk', 'walk2', 'work']);

/**
 * Clé d'apparence « <genre><tenue><chapeau><teinte> » (ex. 'f013') à partir de
 * look = { outfit, hat, tint, gender? } ; gender absent → 'm' (female: true accepté aussi).
 */
export function lookKey(look = {}) {
  const clamp = (v, n) => Math.max(0, Math.min(n - 1, Math.floor(Number(v) || 0)));
  const g = look.gender === 'f' || look.female === true ? 'f' : 'm';
  return `${g}${clamp(look.outfit, STAFF_OUTFITS)}${look.hat ? 1 : 0}${clamp(look.tint, STAFF_TINTS)}`;
}

/**
 * Sprite 16 × 16 d'un employé : 'staff.<clé>' (repos), '.walk', '.walk2' (autre pied), '.work'.
 * Personnage de face ; outil tenu : dessiner 'tool.<can|basket|seedbag|pail|hoe.carry>' par-dessus
 * (repos et marche) ou 'tool.<…>.work' (pose de travail), à la même position.
 */
export function staffSprite(look, pose = 'idle') {
  const key = lookKey(look);
  return pose && pose !== 'idle' && STAFF_POSES.includes(pose) ? `staff.${key}.${pose}` : `staff.${key}`;
}

/** Portrait 32 × 32 (tête et épaules) d'un employé : 'portrait.staff.<clé>'. */
export function staffPortrait(look) {
  return `portrait.staff.${lookKey(look)}`;
}

/** Sprite du joueur : fermier (farmer.outfit.N) ou fermière (farmer.fermiere.outfit.N), avec ou sans chapeau. */
export function playerSprite(outfitId, { female = false, nohat = false } = {}) {
  const name = outfitSprite(outfitId, nohat);
  return female ? name.replace(/^farmer\.outfit\./, 'farmer.fermiere.outfit.') : name;
}

/** Portrait de Joseph selon l'expression : 'content' (défaut), 'surprised', 'proud', 'happy'. */
export function josephPortrait(expr = 'content') {
  return expr && expr !== 'content' ? `portrait.joseph.${expr}` : 'portrait.joseph';
}

/** Bulle de ramassage 'bubble.collect' (32 × 32) : zone du contenu (icône 16 × 16), pointe en bas au centre. */
export const BUBBLE_CONTENT = Object.freeze({ x: 8, y: 4, w: 16, h: 16 });
/** Cadre 'bubble' (16 × 16) à étirer en 9 tranches : bords de 5 px ; 'bubble.tail' se pose sous le bas. */
export const BUBBLE_SLICE = 5;
'''


def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument('--contact', help='dossier où écrire des planches de contrôle ×4')
    ap.add_argument('--phase-a-only', action='store_true')
    args = ap.parse_args()
    for fn in PHASE_A + ([] if args.phase_a_only else PHASE_B):
        fn()
    # alias selon les identifiants des données (src/data/career/buildings.js : roadsideStand)
    for a, t in (('building.roadsideStand.2', 'building.stand.2'), ('building.roadsideStand.3', 'building.stand.3')):
        if has(t):
            alias(a, t)
    pos, rows = pack()
    sheet = img(SHEET_COLS * T, rows * T)
    for name, im in ENTRIES:
        c, r, w, h = pos[name]
        sheet.alpha_composite(im, (c * T, r * T))
    sheet.save(HERE / 'career.png', optimize=True)
    lines = ['  // Généré par assets/sprites/generate-career.py — ne pas modifier à la main.',
             'const career = {']
    for name, _ in ENTRIES:
        lines.append(f"  '{name}': {js_entry(*pos[name])},")
    for name, target in ALIASES:
        lines.append(f"  '{name}': {js_entry(*pos[target])},")
    for name, js in EXTERNAL:
        lines.append(f"  '{name}': {js},")
    lines.append('};')
    block = '\n'.join(lines) + '\n' + JS_HELPERS.strip('\n')
    atlas = ROOT / 'src' / 'render' / 'atlas.js'
    src = atlas.read_text()
    if '// <career:auto>' not in src:
        raise SystemExit('marqueurs // <career:auto> absents de src/render/atlas.js')
    new = re.sub(r'(// <career:auto>\n).*?(// </career:auto>)', lambda m: m.group(1) + block + '\n' + m.group(2),
                 src, flags=re.S)
    atlas.write_text(new)
    print(f'écrit {HERE / "career.png"} ({SHEET_COLS} × {rows} tuiles, {len(ENTRIES)} sprites, '
          f'{len(ALIASES)} alias)')
    if args.contact:
        contact_sheets(Path(args.contact))


def contact_sheets(folder, scale=4):
    """Planches de contrôle : chaque groupe de sprites à ×scale, à côté d'originaux Kenney."""
    folder.mkdir(parents=True, exist_ok=True)
    refs = [farm(1, 9), farm(0, 9), farm(0, 10), farm(1, 10), farm(2, 10), V3S['animal.goat'],
            grid_tiles([[(0, 4), (3, 4), (1, 4), (2, 4)], [(0, 5), (1, 5), (3, 5), (2, 5)],
                        [(0, 6), (0, 7), (1, 7), (3, 6)]])]
    groups = {}
    for name, im in ENTRIES:
        key = name.split('.')[0]
        if key == 'staff':
            key = 'staff.' + name.split('.')[1][0]
        groups.setdefault(key, []).append(im)
    for key, ims in groups.items():
        W = 1600
        x = y = rowh = 0
        placed = []
        for im in refs + ims:
            w, h = im.width * scale + 8, im.height * scale + 8
            if x + w > W:
                x, y, rowh = 0, y + rowh, 0
            placed.append((x, y, im))
            x += w
            rowh = max(rowh, h)
        out = Image.new('RGBA', (W, y + rowh), (132, 198, 105, 255))
        for (x, y, im) in placed:
            out.alpha_composite(im.resize((im.width * scale, im.height * scale), Image.NEAREST), (x + 4, y + 4))
        out.save(folder / f'art-career-{key}.png')


# ===========================================================================
# Phase B : mare et ponton, poissons, canards, serre, conserverie, filature, ateliers niv. 4-5,
# château d'eau, convoyeur, marché fermier, embellissements, cerisier, poirier, chat, chien, arc-en-ciel

def water_tile(frame=0):
    t = img(16, 16)
    for y in range(16):
        for x in range(16):
            t.putpixel((x, y), rgba('c'))
    for (x, y) in ((2, 3), (3, 3), (4, 3), (10, 7), (11, 7), (12, 7), (5, 12), (6, 12), (7, 12)):
        dot(t, (x + frame * 3) % 16, y, 'v')
    for (x, y) in ((8, 1), (9, 1), (1, 9), (2, 9), (13, 13), (14, 13)):
        dot(t, (x + frame * 3) % 16, y, 'C')
    return t


def pond_from_path(c, r, frame=0):
    """Mare : même autotuile que le chemin Tiny Town (bords herbeux), terre remplacée par l'eau,
    avec une berge sombre d'1 px entre l'herbe et l'eau."""
    src = town(c, r)
    out = src.copy()
    px = out.load()
    w = water_tile(frame).load()
    dirt = {PAL['b'], PAL['B'], PAL['k']}
    water = set()
    for y in range(16):
        for x in range(16):
            p = px[x, y]
            if p[3] and p[:3] in dirt:
                px[x, y] = w[x, y]
                water.add((x, y))
    for (x, y) in water:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            q = (x + dx, y + dy)
            if 0 <= q[0] < 16 and 0 <= q[1] < 16 and q not in water:
                px[x, y] = rgba('u')
                break
    return out


LILY = ['................', '................', '................', '................', '.....GGG.GG.....',
        '....GgGGGGGd....', '....GGGpPGGd....', '....GGGPwGdd....', '.....ddddddd....']
REEDS = ['................', '................', '.....n...n......', '.....N.n.N......', '.....d.N.d..n...',
         '....dd.d.d..N...', '....d..d.dd.d...', '....d.dd..d.d...', '...dd.d...d.dd..', '...d..d..dd..d..',
         '...Gd.dG.d.dG...', '..GGGGGGGGGGGG..']


def dock():
    im = img(48, 16)
    g = Grid(48, 16)
    g.rect(2, 3, 45, 9, 'b')
    for x in range(2, 46, 5):
        g.rect(x, 3, x, 9, 'B')
    g.rect(2, 3, 45, 3, 'k')
    for x in (6, 22, 38):
        g.rect(x, 10, x + 1, 13, 'N')
    im.alpha_composite(art(g.rows(), w=48, h=16))
    return im


def glass_tiles():
    out = {}
    def pane(kind):
        g = Grid(16, 16)
        g.rect(0, 0, 15, 15, 'c')
        for x in range(16):
            for y in range(16):
                if x % 8 == 0 or y % 8 == 0:
                    g.set(x, y, 'S')
                elif (x + y) % 8 == 3 and x % 8 < 4:
                    g.set(x, y, 'v')
        if kind == 'roof':
            for x in range(16):
                g.set(x, 15, 'M')
        if kind == 'wall':
            for x in range(16):
                g.set(x, 12, 'S')
            g.rect(0, 13, 15, 15, 'd')
            for x in range(0, 16, 3):
                g.set(x, 14, 'G')
        return g.rows()
    for kind in ('roof', 'wall'):
        rows = pane(kind)
        out[f'glass.{kind}.c'] = art(rows, outline=0)
        l = [('AA' + r[2:]) for r in rows]
        rr = [(r[:14] + 'AA') for r in rows]
        out[f'glass.{kind}.l'] = art(l, outline=0)
        out[f'glass.{kind}.r'] = art(rr, outline=0)
    top = pane('roof')
    out['glass.roof.top'] = art(['AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAA', 'W' * 16] + top[3:], outline=0)
    door = pane('wall')
    door = [r[:5] + 'NnnnnN' + r[11:] if 3 <= i else r for i, r in enumerate(door)]
    out['glass.door'] = art(door, outline=0)
    return out


def greenhouse(level):
    """Serre complète (6 × 4) assemblée des tuiles de verre ; niv. 3 : cheminée et lueur chaude."""
    tiles = glass_tiles()
    im = canvas(6, 4)
    for y in range(4):
        for x in range(6):
            if y < 2:
                name = 'glass.roof.top' if y == 0 else 'glass.roof.c'
            else:
                name = 'glass.wall.c'
            if y == 3 and x == 2:
                name = 'glass.door'
            t = tiles[name].copy()
            paste(im, t, x * 16, y * 16)
    if level >= 2:
        for x in range(8, 96, 16):
            stamp(im, ['.G.', 'GdG', '.d.'], x, 52, outline=0)
    if level == 3:
        px = im.load()
        for y in range(im.height):
            for x in range(im.width):
                p = px[x, y]
                if p[:3] == PAL['c']:
                    px[x, y] = rgba('i')
                elif p[:3] == PAL['v']:
                    px[x, y] = rgba('w')
    for y in range(64):
        for x in (0, 1, 94, 95):
            dot(im, x, y, 'A')
    for x in range(96):
        for y in (0, 1, 62, 63):
            dot(im, x, y, 'A')
    for x in range(2, 94):
        dot(im, x, 2, 'W')
    if level == 3:
        chim = img(96, 64)
        stamp(chim, ['MMMM', 'SSSM', 'SSSM', 'SSSM', 'SSSM'], 80, 2)
        stamp(chim, ['.W.W', 'W.W.'], 80, 0, outline=0)
        im.alpha_composite(chim)
    return im


def workshop(roof, wall, sign_rows, extra=None):
    im = canvas(3, 3)
    gable_barn(im, 3, 44, 4, 26, 45, roof, wall, None, 'wood', gable_window=True)
    stamp(im, sign_rows, 28, 30)
    if extra:
        extra(im)
    return finish(im)


def cannery_extra(im):
    stamp(im, ['SSSS', 'SMMS', 'SSSS', 'SSSS', 'SSSS', 'SSSS'], 37, 0)   # cheminée
    for i in range(3):
        stamp(im, ['.SS.', 'SRRS', 'SRRS', 'SSSS'], 6 + i * 6, 38)


def mill_extra(im):
    for i in range(2):
        stamp(im, ['.bb.', 'bPPb', 'PPPP', 'bPPb', '.bb.'], 7 + i * 7, 38)


SIGN_CANNERY = ['kkkkkkkk', 'kSSSSSSk', 'kSRRRRSk', 'kSRRRRSk', 'kSSSSSSk', 'bbbbbbbb']
SIGN_YARN = ['kkkkkkkk', 'kkPPPPkk', 'kPQPQPPk', 'kPPQPQPk', 'kkPPPPnk', 'bbbbbbbb']
TOMATO_SAUCE = ['................', '................', '......SS........', '.....SSSS.......', '......RR........',
                '.....RrRR.......', '....RrRRRq......', '....RkkkRq......', '....RkRkRq......', '....RkkkRq......',
                '....RRRRRq......', '.....qqqq.......']
PUMPKIN_SOUP = ['................', '................', '................', '...........n....', '..........n.....',
                '...YYYYYYYYY....', '..YyyiyyyyyYo...', '..oYYYYYYYYoo...', '...SWsssssSS....', '...SWsssssSS....',
                '....SSSSSSS.....', '.....MMMMM......']
RATATOUILLE = ['................', '................', '................', '................', '....RgGyRgR.....',
               '...RGRyRGyRG....', '..SSSSSSSSSSS...', '..MSWsssssSSM...', '...SSSSSSSSS....', '....MMMMMMM.....']
YARN = ['................', '................', '................', '.....PPPP.......', '...PPQPPQPP.....',
        '..PQPPQPPQPP....', '..PPQPPQPPQP....', '..QPPQPPQPPQ....', '..PQPPQPPQPP....', '...PPQPPQPP.....',
        '....QQQQQ...Q...', '..........Q.Q...']


def water_tower():
    im = img(32, 64)
    g = Grid(32, 64)
    for y in range(8, 26):
        for x in range(4, 28):
            k = (x - 4) / 23
            g.set(x, y, 'W' if k < 0.15 else 's' if k < 0.6 else 'S' if k < 0.9 else 'M')
    for y in range(3, 8):
        half = 3 + (y - 3) * 2.6
        for x in range(round(16 - half), round(16 + half)):
            g.set(x, y, 'R' if x > 16 else 'r')
    g.rect(4, 25, 27, 26, 'M')
    for (x0, x1) in ((6, 3), (25, 28)):
        for y in range(27, 62):
            t = (y - 27) / 34
            g.set(round(x0 + (x1 - x0) * t), y, 'n')
    for y in range(27, 62):
        g.set(13, y, 'N'); g.set(18, y, 'N')
    for y in (36, 48):
        g.rect(6, y, 25, y, 'n')
    for x in range(6, 26, 2):
        g.set(x, 16, 'M')
    im.alpha_composite(art(g.rows(), w=32, h=64))
    return im


def conveyor(vertical=False, frame=0):
    g = Grid(16, 16)
    if not vertical:
        g.rect(0, 5, 15, 5, 'S'); g.rect(0, 10, 15, 10, 'S')
        for x in range(16):
            for y in range(6, 10):
                g.set(x, y, 'M' if (x + frame * 2) % 4 == 0 else 's')
        g.set(3, 12, 'M'); g.set(12, 12, 'M'); g.set(3, 11, 'M'); g.set(12, 11, 'M')
    else:
        g.rect(5, 0, 5, 15, 'S'); g.rect(10, 0, 10, 15, 'S')
        for y in range(16):
            for x in range(6, 10):
                g.set(x, y, 'M' if (y + frame * 2) % 4 == 0 else 's')
    return art(g.rows(), outline=0)


def farmers_market():
    im = canvas(5, 3)
    # halle : toit de tuiles sur poteaux, étals sous l'auvent
    for y in range(3, 18):
        k = (y - 3) / 14
        x0, x1 = round(14 - 12 * k), round(65 + 12 * k)
        for x in range(x0, x1 + 1):
            fill(im, [(x, y)], 'red', 0, 3)
    hline(im, 2, 77, 17, 'q')
    for x in (6, 28, 50, 72):
        vline(im, x, 18, 44, 'n'); vline(im, x + 1, 18, 44, 'N')
    for i in range(3):
        bx = 9 + i * 22
        for x in range(bx, bx + 18):
            c = ('R', 'w') if i != 1 else ('C', 'w')
            col = c[0] if (x // 3) % 2 == 0 else c[1]
            for y in range(18, 22):
                dot(im, x, y, col)
        fill_rect(im, bx, 32, bx + 17, 44, 'barn')
        hline(im, bx, bx + 17, 32, 'k')
    im = finish(im)
    for i, (c, r) in enumerate(((11, 0), (11, 3), (11, 5), (11, 1), (11, 4), (11, 2))):
        crate = farm(c, r).crop((0, 4, 16, 16))
        paste(im, crate, 9 + (i // 2) * 22 + (i % 2) * 9, 24)
    return im


def fountain(frame=0):
    im = img(32, 32)
    g = Grid(32, 32)
    for (x, y) in ellipse_cells(16, 23, 14, 6):
        g.set(x, y, 'S')
    for (x, y) in ellipse_cells(16, 22, 12, 4.5):
        g.set(x, y, 'c')
    g.rect(14, 8, 17, 22, 's')
    g.rect(14, 8, 14, 22, 'W')
    for (x, y) in ellipse_cells(16, 9, 6, 2):
        g.set(x, y, 'S')
    for (x, y) in ((15, 3), (16, 3), (15, 4), (16, 4), (15, 5), (16, 5)):
        g.set(x, y, 'v')
    for i, (x, y) in enumerate(((10, 10), (9, 12), (8, 15), (22, 10), (23, 12), (24, 15))):
        if (i + frame) % 2 == 0:
            g.set(x, y, 'v')
        else:
            g.set(x, y + 1, 'c')
    g.set(10 + frame * 3, 21, 'v'); g.set(20 - frame * 2, 23, 'v')
    return art(g.rows(), w=32, h=32)


def bandstand():
    im = img(48, 48)
    g = Grid(48, 48)
    for y in range(4, 18):
        k = (y - 4) / 13
        x0, x1 = round(22 - 20 * k), round(25 + 20 * k)
        for x in range(x0, x1 + 1):
            g.set(x, y, 'G' if x < 24 else 'd')
            if y % 4 == 0 and x % 2:
                g.set(x, y, 'g')
    g.rect(2, 18, 45, 19, 'w')
    for x in range(2, 46, 3):
        g.set(x, 20, 'w')
    for x in (4, 15, 32, 43):
        g.rect(x, 20, x + 1, 36, 'W')
    g.rect(1, 37, 46, 43, 'b')
    g.rect(1, 37, 46, 37, 'k')
    for x in range(3, 46, 4):
        g.rect(x, 38, x, 43, 'B')
    g.rect(23, 1, 24, 3, 'y')
    return art(g.rows(), w=48, h=48)


def statue():
    g = Grid(32, 32)
    g.rect(8, 22, 23, 29, 'S')
    g.rect(8, 22, 23, 22, 'W')
    g.rect(10, 24, 21, 27, 's')
    body = ['..sss..', '.sWss s', '..sss..', '.sssss.', 'sWsssSs', 'sWsssSs', '.sssSs.', '.ss.ss.',
            '.ss.ss.', '.ss.ss.', 'sSS.SSs']
    g.stamp([r.replace(' ', 's') for r in body], 12, 5)
    g.stamp(['.MMM.', 'MMMMM'], 13, 3)
    return art(g.rows(), w=32, h=32)


def formal_garden():
    im = img(64, 48)
    g = Grid(64, 48)
    for y in range(4, 44):
        for x in range(3, 61):
            g.set(x, y, 'k' if (x + y) % 7 else 'b')
    for (x0, y0) in ((6, 7), (36, 7), (6, 27), (36, 27)):
        g.rect(x0, y0, x0 + 21, y0 + 13, 'd')
        g.rect(x0 + 2, y0 + 2, x0 + 19, y0 + 11, 'G')
        for i in range(4):
            g.set(x0 + 4 + i * 4, y0 + 6, 'E' if i % 2 else 'p')
    for (x, y) in ellipse_cells(32, 24, 4, 4):
        g.set(x, y, 'c')
    return art(g.rows(), w=64, h=48)


def fruit_trees():
    for tree, fruit, blossom in (('cherry', {PAL['r']: PAL['R'], PAL['R']: PAL['q'], PAL['q']: PAL['H']},
                                  {PAL['w']: PAL['K'], PAL['e']: PAL['K'], PAL['p']: PAL['L']}),
                                 ('pear', {PAL['r']: PAL['i'], PAL['R']: PAL['y'], PAL['q']: PAL['Y']}, {})):
        for stage in ('sapling', 'young', 'spring', 'summer', 'summer.ripe', 'autumn', 'autumn.ripe', 'winter', 'dead'):
            im = V3S[f'tree.apple.{stage}']
            if stage == 'spring':
                im = recolor(im, blossom) if blossom else im
            elif 'ripe' in stage or stage == 'summer':
                im = recolor(im, fruit)
            add(f'tree.{tree}.{stage}', im)
    add('tree.cherry.icon', art(['................', '................', '........dd......', '.......d.Gd.....',
                                 '......d...d.....', '.....d....d.....', '....RR...RR.....', '...RrRq.RrRq.....'[:16],
                                 '...RRqq.RRqq....', '....qq...qq.....']))
    add('tree.pear.icon', art(['................', '................', '.......N........', '.......dG.......',
                               '......yy........', '.....yiyY.......', '.....yyyY.......', '....yiyyYY......',
                               '...yyyyyyYY.....', '...yyyyyyYo.....', '....YYYYYo......', '.....ooo........']))
    add('product.cherryJam', recolor(V3S['product.jam'], {PAL['R']: PAL['q'], PAL['q']: PAL['H'], PAL['r']: PAL['R']}))
    add('product.pearJuice', recolor(V3S['product.juice'], {PAL['y']: PAL['g'], PAL['Y']: PAL['G']}))


CAT = ['................', '................', '................', '................', '..........Y..Y..',
       '..........YYYY..', '..........YZYZ..', '.Y........YYYYp.', '.Y......YYYYY...', '..Y..YYYYYYY....',
       '..YYYYyYyYYY....', '...YYYYYYYYY....', '...Y.Y...Y.Y....', '...o.o...o.o....']
CAT_SIT = ['................', '................', '................', '................', '.......Y..Y.....',
           '.......YYYY.....', '.......ZYZY.....', '.......pYYY.....', '.......YYYYY....', '......YyYyYY....',
           '......YYYYYY....', '......YYyYYY.YY.', '......YYYYYYYY..', '.......oo.oo....']
DOG = ['................', '................', '................', '...........NN...', '..........nnnN..',
       '..........nZnnN.', '.n........nnnnZ.', '..n.......nnnn..', '..nnnnnnnnnnn...', '..nnkknnnnnnn...',
       '..nnnnnnnnnnN...', '..NnnnnnnnnnN...', '...n.n...n.n....', '...N.N...N.N....']
DOG_SIT = ['................', '................', '................', '.........NN.....', '........nnnN.....'[:16],
           '........nZnnN...', '........nnnnZ...', '........nnnn....', '.......nnnnn....', '......nnkknnn...',
           '......nnnnnnn...', '..n...nnnnnnn...', '...nnnnnnnnnN...', '......NN.NN.....']


def walk_rows(rows):
    """Deuxième image de marche : pattes décalées."""
    out = list(rows)
    out[-2] = out[-2].replace('.Y.Y...Y.Y', 'Y.Y...Y.Y.').replace('.n.n...n.n', 'n.n...n.n.')
    out[-1] = out[-1].replace('.o.o...o.o', 'o.o...o.o.').replace('.N.N...N.N', 'N.N...N.N.')
    return out


def rainbow():
    g = Grid(64, 32)
    colors = 'EYyGCQ'
    for i, c in enumerate(colors):
        r_out = 30 - i * 2
        for y in range(32):
            for x in range(64):
                d = math.hypot(x + 0.5 - 32, y + 0.5 - 32)
                if r_out - 2 < d <= r_out:
                    g.set(x, y, {'E': 'E', 'Y': 'Y', 'y': 'y', 'G': 'G', 'C': 'C', 'Q': 'P'}[c])
    return art(g.rows(), outline=0, w=64, h=32)


def phase_b_section():
    names = {'tl': (0, 1), 't': (1, 1), 'tr': (2, 1), 'l': (0, 2), 'c': (1, 2), 'r': (2, 2),
             'bl': (0, 3), 'b': (1, 3), 'br': (2, 3),
             'inner.tl': (3, 3), 'inner.tr': (4, 3), 'inner.br': (5, 3), 'inner.bl': (6, 3)}
    for n, (c, r) in names.items():
        add(f'water.{n}', pond_from_path(c, r, 0))
    add('water.c.1', pond_from_path(1, 2, 1))
    add('water.lily', art(LILY, outline=1))
    add('water.reeds', art(REEDS, outline=1))
    add('pond.dock', dock())
    for n, t in glass_tiles().items():
        add(n, t)
    for lv in (1, 2, 3):
        add(f'building.greenhouse.{lv}', greenhouse(lv))
    add('building.cannery', workshop('slate', 'brick', SIGN_CANNERY, cannery_extra))
    add('building.spinningMill', workshop('thatch', 'woodlight', SIGN_YARN, mill_extra))
    add('product.tomatoSauce', art(TOMATO_SAUCE))
    add('product.pumpkinSoup', art(PUMPKIN_SOUP))
    add('product.ratatouille', art(RATATOUILLE))
    add('product.yarn', art(YARN))
    add('part.sign.gold', recolor(V3S['part.sign.jam'], {PAL['k']: PAL['y'], PAL['b']: PAL['Y']})
        if False else art(['yyyyyyyy', 'yiiiiiiY', 'yiYiiYiY', 'yiiYYiiY', 'yiiiiiiY', 'YYYYYYYY'], outline=1, w=16, h=16))
    annex = canvas(1, 2)
    lean_to(annex, 1, 14, 6, 29, roof='red', wall='stone', window=WINDOW)
    add('part.annex', finish(annex))
    add('machine.waterTower', water_tower())
    for f in (0, 1):
        add(f'machine.conveyor.h' + ('.1' if f else ''), conveyor(False, f))
        add(f'machine.conveyor.v' + ('.1' if f else ''), conveyor(True, f))
    add('building.stand.3', farmers_market())
    add('embellish.fountain', fountain(0))
    add('embellish.fountain.1', fountain(1))
    add('embellish.bandstand', bandstand())
    add('embellish.statue', statue())
    add('embellish.garden', formal_garden())
    fruit_trees()
    add('pet.cat', art(CAT_SIT))
    add('pet.cat.walk.1', art(CAT))
    add('pet.cat.walk.2', art(walk_rows(CAT)))
    add('pet.dog', art(DOG_SIT))
    add('pet.dog.walk.1', art(DOG))
    add('pet.dog.walk.2', art(walk_rows(DOG)))
    add('effect.rainbow', rainbow())


PHASE_B += [duck_section, fish_section, phase_b_section]


if __name__ == '__main__':
    main()
