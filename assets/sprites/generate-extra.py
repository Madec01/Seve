#!/usr/bin/env python3
"""Génère assets/sprites/extra.png : tuiles 16×16 dérivées des packs Kenney (CC0).

Contenu (la position de chaque tuile est reprise dans src/render/atlas.js, feuille « extra ») :
  ligne 0 : plants « pas encore mûrs » (fruits recolorés en vert) servant d'étape intermédiaire
            col 0 carotte (d'après l'étape Kenney 2), col 1 navet (étape 2), col 2 tomate (étape 2),
            col 3 maïs (étape 3), col 4 blé (étape 3), col 5 bouton de tournesol, col 6 chou (étape 3 éclaircie)
  ligne 1 : col 0 sachet de graines tournesol, col 1 sac tournesol, col 2 cagette de tournesols,
            col 3 panneau solaire, col 4 arroseur automatique, col 5 tournesol fané,
            col 6 graines semées (étape 0 de toutes les cultures)

Relancer après modification :  python3 assets/sprites/generate-extra.py   (nécessite Pillow)
"""
from pathlib import Path
from PIL import Image

HERE = Path(__file__).resolve().parent
FARM = Image.open(HERE / 'tiny-farm.png').convert('RGBA')
T = 16

# Palette Kenney Tiny Farm
OUT = (63, 38, 49)
G_DARK, G_MID, G_LIGHT = (78, 151, 76), (132, 198, 105), (198, 229, 141)
LABEL = (253, 214, 180)          # fond de l'étiquette des sachets
BAG = (234, 165, 108)
Y_LIGHT, Y_DARK = (253, 190, 83), (227, 134, 40)
BROWN, BROWN_DARK = (189, 108, 74), (118, 59, 54)
MET_DARK, MET, MET_LIGHT = (82, 96, 124), (139, 155, 180), (192, 203, 220)
NAVY = (62, 78, 110)
BLUE, BLUE_LIGHT, WHITE = (121, 167, 232), (153, 216, 248), (235, 239, 248)


def tile(col, row, sheet=FARM):
    return sheet.crop((col * T, row * T, col * T + T, row * T + T))


def lum(p):
    return 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]


def is_green(p):
    return p[:3] in (G_DARK, G_MID, G_LIGHT) or (p[1] > p[0] + 20 and p[1] > p[2])


def unripe(t, only_rows=None):
    """Recolore en vert tendre tout ce qui n'est ni contour ni feuillage (fruits pas mûrs)."""
    t = t.copy()
    px = t.load()
    for y in range(T):
        if only_rows is not None and y not in only_rows:
            continue
        for x in range(T):
            p = px[x, y]
            if p[3] == 0 or p[:3] == OUT or is_green(p):
                continue
            # le bois des cagettes / la terre ne sont pas concernés (tuiles de plantes uniquement)
            l = lum(p)
            q = G_LIGHT if l > 150 else (160, 205, 110) if l > 110 else (110, 170, 90)
            px[x, y] = q + (255,)
    return t


def lighten_greens(t):
    """Chou « pas encore pommé » : vert plus clair, tête moins dense."""
    t = t.copy()
    px = t.load()
    for y in range(T):
        for x in range(T):
            p = px[x, y]
            if p[3] == 0:
                continue
            if p[:3] == G_DARK:
                px[x, y] = G_MID + (255,)
            elif p[:3] == G_MID:
                px[x, y] = G_LIGHT + (255,)
    return t


def put(t, pixels):
    px = t.load()
    for (x, y), c in pixels.items():
        px[x, y] = c + (255,)


def clear_label(t, x0, y0, x1, y1):
    """Efface l'emblème d'un sachet (tout ce qui n'est ni contour, ni toile, ni fond d'étiquette)."""
    px = t.load()
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            p = px[x, y][:3]
            if p not in (OUT, BAG, LABEL, (207, 130, 84), (254, 201, 156)):
                px[x, y] = LABEL + (255,)


def sunflower_emblem(x0, y0):
    """Petite fleur 4×4 : pétales jaunes, cœur brun."""
    N, C = Y_LIGHT, BROWN
    return {
        (x0 + 1, y0): N, (x0 + 2, y0): N,
        (x0, y0 + 1): N, (x0 + 1, y0 + 1): C, (x0 + 2, y0 + 1): C, (x0 + 3, y0 + 1): N,
        (x0, y0 + 2): N, (x0 + 1, y0 + 2): C, (x0 + 2, y0 + 2): C, (x0 + 3, y0 + 2): N,
        (x0 + 1, y0 + 3): Y_DARK, (x0 + 2, y0 + 3): Y_DARK,
    }


def seedbag_sunflower():
    t = tile(10, 0).copy()              # sachet carotte, dont on remplace l'emblème
    clear_label(t, 5, 6, 10, 11)
    put(t, sunflower_emblem(6, 7))
    return t


def sack_sunflower():
    t = tile(9, 0).copy()               # grand sac carotte
    clear_label(t, 5, 7, 10, 12)
    put(t, sunflower_emblem(6, 8))
    return t


def crate_sunflower():
    base = tile(4, 6).copy()            # cagette vide
    head = tile(11, 6).crop((4, 2, 12, 10))   # tête de tournesol 8×8 avec son contour
    out = Image.new('RGBA', (T, T))
    out.alpha_composite(base)
    out.alpha_composite(head, (1, 1))
    out.alpha_composite(head, (7, 1))
    return out


def withered_sunflower():
    """Tournesol fané : pétales et feuilles brunis."""
    t = tile(11, 6).copy()
    px = t.load()
    for y in range(T):
        for x in range(T):
            p = px[x, y]
            if p[3] == 0 or p[:3] == OUT:
                continue
            l = lum(p)
            px[x, y] = ((207, 130, 84) if l > 170 else (189, 108, 74) if l > 120 else (118, 59, 54)) + (255,)
    return t


def draw_rows(rows, palette):
    t = Image.new('RGBA', (T, T))
    px = t.load()
    for y, line in enumerate(rows):
        assert len(line) == T, (y, line, len(line))
        for x, ch in enumerate(line):
            if ch != '.':
                px[x, y] = palette[ch] + (255,)
    return t


PAL = {'A': OUT, 'M': MET_DARK, 'S': MET, 'L': MET_LIGHT, 'n': NAVY, 'b': BLUE,
       'c': BLUE_LIGHT, 'w': WHITE, 'g': G_MID, 'd': G_DARK,
       'J': BROWN_DARK, 'k': (254, 201, 156)}

SOLAR = [
    '................',
    '.AAAAAAAAAAAAAA.',
    '.ALLLLLLLLLLLLA.',
    '.ALnwnbnnbnnnLA.',
    '.ALwnnbnnbnnnLA.',
    '.ALbbbbbbbbbbLA.',
    '.ALnnnbnnbnnnLA.',
    '.ALnnnbnnbnncLA.',
    '.ASSSSSSSSSSSSA.',
    '.AAAAAAAAAAAAAA.',
    '......ASSA......',
    '......ASMA......',
    '......ASMA......',
    '....AAASMAAA....',
    '....ASSSSSSA....',
    '....AAAAAAAA....',
]

# Graines fraîchement semées (étape 0) : quatre graines claires posées sur un sillon sombre
SEEDS = [
    '................',
    '................',
    '................',
    '................',
    '.........k......',
    '........JJJ.....',
    '....k...........',
    '...JJJ..........',
    '................',
    '..........k.....',
    '.........JJJ....',
    '.....k..........',
    '....JJJ.........',
    '................',
    '................',
    '................',
]

SPRINKLER = [
    '................',
    '.....c....c.....',
    '...c...cc...c...',
    '..c..c....c..c..',
    '.c..c..cc..c..c.',
    '...c..c..c..c...',
    '..c...AAAA...c..',
    '.....ALLLSA.....',
    '.....AMMMMA.....',
    '......ALSA......',
    '......ALSA......',
    '......ALSA......',
    '.....dALSAd.....',
    '....dgALSAgd....',
    '....AAAAAAAA....',
    '................',
]


def main():
    sheet = Image.new('RGBA', (8 * T, 2 * T))
    row0 = [
        unripe(tile(5, 0)),              # carotte
        unripe(tile(5, 1)),              # navet
        unripe(tile(5, 3)),              # tomate
        unripe(tile(6, 2)),              # maïs
        unripe(tile(6, 5)),              # blé
        unripe(tile(11, 6)),             # tournesol (bouton)
        lighten_greens(tile(6, 4)),      # chou
    ]
    row1 = [
        seedbag_sunflower(),
        sack_sunflower(),
        crate_sunflower(),
        draw_rows(SOLAR, PAL),
        draw_rows(SPRINKLER, PAL),
        withered_sunflower(),
        draw_rows(SEEDS, PAL),
    ]
    for i, t in enumerate(row0):
        sheet.alpha_composite(t, (i * T, 0))
    for i, t in enumerate(row1):
        sheet.alpha_composite(t, (i * T, T))
    sheet.save(HERE / 'extra.png')
    print('écrit', HERE / 'extra.png')


if __name__ == '__main__':
    main()
