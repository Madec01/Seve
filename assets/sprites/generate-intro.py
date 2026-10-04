#!/usr/bin/env python3
"""Génère la planche de l'intro « MG studios » : assets/sprites/intro.png et la table src/intro/sheet.js.

L'intro (src/intro/, docs/ARCHITECTURE.md, « Intro MG studios ») se joue AVANT que le jeu soit chargé : elle ne
doit attendre ni le paquet du jeu ni ses grandes planches. Cette petite planche (quelques Ko) réunit tout ce que
l'animation dessine à partir d'images :

  - tuiles extraites des planches du jeu (Kenney Tiny Town / Tiny Farm, CC0 ; valley1.png, création du jeu, CC0) :
      grass.0..2   herbe, touffe, fleurs            (tiny-town 0..2, 0)
      fence        clôture                          (tiny-town 9, 6)
      tree.a/.b    arbres 16 × 32                   (tiny-town 3 et 4, 0)
      soil         terre labourée                   (tiny-farm 1, 5)
      crop.0..3    cultures mûres                   (tiny-farm 6, 5 / 0 / 4 / 1)
      hen, cow, sheep                               (tiny-farm 2 / 1 / 0, 10)
      bird.0/.1    oiseaux lointains (2 images)     (valley1 7 et 8, 17 : fx.birds)
  - le coq, dessiné pour l'intro (création originale, CC0) : rooster.idle (16 × 18), rooster.crow (bec ouvert,
    cou tendu, 17 × 18), rooster.flap (ailes levées, 16 × 18), rooster.puff (poitrail gonflé, tête haute, bec
    fermé : le dernier petit geste de la fin, 17 × 18).

Le panneau, la planchette « studios », le ciel, le soleil et le monogramme MG sont dessinés par le code
(src/intro/mg-studios.js, créations originales CC0).

Relancer :  python3 assets/sprites/generate-intro.py   (nécessite Pillow)
"""
import sys
sys.dont_write_bytecode = True

from pathlib import Path
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent

K = (63, 38, 49)
HEX = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
ROOSTER_PAL = {
    'K': K, 'R': HEX('#e2665b'), 'G': HEX('#fdbe53'), 'O': HEX('#e38628'), 'B': HEX('#b86542'), 'b': HEX('#8e5236'),
    'T': HEX('#262b44'), 't': HEX('#3b6891'), 'g': HEX('#528738'), 'W': HEX('#8e3f38'), 'w': HEX('#c34b35'),
    'Y': HEX('#fdbe53'),
}
ROOSTER = {
    'idle': [
        '................',
        '..........K.K...',
        '.........KRKRK..',
        '..KK....KRRRRK..',
        '.KTtK...KGGGGK..',
        'KTKgTK.KGGKGGKK.',
        'KTKKtTKKGGGGGYYK',
        'KTK.KgTKOGGGRKK.',
        'KK..KTTKOOGGRK..',
        '....KTTKBOOGKK..',
        '...KTTKBBBOOK...',
        '...KTKBWWWBBBK..',
        '...KTKWwwWWBBK..',
        '....KKBWWWBBbK..',
        '.....KbBBBBbK...',
        '......KKbbbKK...',
        '.......KYKYK....',
        '......KYYKYYK...',
    ],
    # poitrail gonflé, cou tendu, tête levée, bec ouvert
    'crow': [
        '..........K.K....',
        '.........KRKRK...',
        '..KK....KRRRRK.KK',
        '.KTtK...KGGGGKKYK',
        'KTKgTK.KGGKGGKYK.',
        'KTKKtTKKGGGGGK...',
        'KTK.KgTKOGGGKYYK.',
        'KK..KTTKOOGGRKK..',
        '....KTTKOOGGRK...',
        '...KTTKBOOOGKK...',
        '...KTKBBBOOOOK...',
        '...KTKBWWWBBBBK..',
        '...KTKWwwWWBBBK..',
        '....KKBWWWBBBbK..',
        '.....KbBBBBBbK...',
        '......KKbbbbK....',
        '.......KYKYK.....',
        '......KYYKYYK....',
    ],
    # ailes levées (petit envol)
    'flap': [
        '................',
        '..........K.K...',
        '.....KK..KRKRK..',
        '..KKKWwK.KRRRRK.',
        '.KTKWwwWKKGGGGK.',
        'KTKgKWwWKGGKGGKK',
        'KTKKtKWWKGGGGGYK',
        'KTK.KtKWKOGGGRK.',
        'KK..KTTKKOOGGRK.',
        '....KTTKBBOOGKK.',
        '...KTTKBBBBOOK..',
        '...KTKBBBBBBBK..',
        '...KTKBBBBBBBK..',
        '....KKBBBBBBbK..',
        '.....KbBBBBbK...',
        '......KKbbbKK...',
        '.......KYKYK....',
        '......KYYKYYK...',
    ],
    # fin de l'intro : il gonfle le poitrail, tête haute, bec fermé (fierté)
    'puff': [
        '..........K.K....',
        '.........KRKRK...',
        '..KK....KRRRRK...',
        '.KTtK...KGGGGK...',
        'KTKgTK.KGGKGGKK..',
        'KTKKtTKKGGGGGYYK.',
        'KTK.KgTKOGGGGRKK.',
        'KK..KTTKOOGGGRK..',
        '....KTTKOOOGGGK..',
        '....KTTKBOOOGGK..',
        '...KTTKBBBOOOGK..',
        '...KTKBWWWBBOOK..',
        '...KTKWwwWWBBBK..',
        '....KKBWWWBBbK...',
        '.....KbBBBBbK....',
        '......KKbbbKK....',
        '.......KYKYK.....',
        '......KYYKYYK....',
    ],
}

# nom → (planche source, colonne, ligne, largeur en tuiles, hauteur en tuiles)
TILES = [
    ('grass.0', 'tiny-town', 0, 0, 1, 1),
    ('grass.1', 'tiny-town', 1, 0, 1, 1),
    ('grass.2', 'tiny-town', 2, 0, 1, 1),
    ('fence', 'tiny-town', 9, 6, 1, 1),
    ('soil', 'tiny-farm', 1, 5, 1, 1),
    ('hen', 'tiny-farm', 2, 10, 1, 1),
    ('cow', 'tiny-farm', 1, 10, 1, 1),
    ('sheep', 'tiny-farm', 0, 10, 1, 1),
    ('bird.0', 'valley1', 7, 17, 1, 1),
    ('bird.1', 'valley1', 8, 17, 1, 1),
    ('crop.0', 'tiny-farm', 6, 5, 1, 1),
    ('crop.1', 'tiny-farm', 6, 0, 1, 1),
    ('crop.2', 'tiny-farm', 6, 4, 1, 1),
    ('crop.3', 'tiny-farm', 6, 1, 1, 1),
    ('tree.a', 'tiny-town', 3, 0, 1, 2),
    ('tree.b', 'tiny-town', 4, 0, 1, 2),
]


def build():
    W, H = 160, 72
    sheet = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    srcs = {}
    rects = {}
    # rangée 0 : dix tuiles ; rangée 1 : cultures puis arbres (16 × 32)
    slots = [(i * 16, 0) for i in range(10)] + [(i * 16, 16) for i in range(4)] + [(64, 16), (80, 16)]
    for (name, src, col, row, tw, th), (x, y) in zip(TILES, slots):
        if src not in srcs:
            srcs[src] = Image.open(HERE / f'{src}.png').convert('RGBA')
        tile = srcs[src].crop((col * 16, row * 16, (col + tw) * 16, (row + th) * 16))
        sheet.paste(tile, (x, y))
        rects[name] = (x, y, tw * 16, th * 16)
    # coqs : rangée 48 px, cases de 24 px
    for i, key in enumerate(['idle', 'crow', 'flap', 'puff']):
        rows = ROOSTER[key]
        x0, y0 = i * 24, 48
        w = max(len(r) for r in rows)
        for y, r in enumerate(rows):
            for x, ch in enumerate(r):
                c = ROOSTER_PAL.get(ch)
                if c:
                    sheet.putpixel((x0 + x, y0 + y), c + (255,))
        rects[f'rooster.{key}'] = (x0, y0, w, len(rows))
    out = HERE / 'intro.png'
    sheet.save(out, optimize=True)
    lines = [
        '// Table de la planche de l\'intro (assets/sprites/intro.png) : [x, y, largeur, hauteur] en pixels.',
        '// Fichier généré par assets/sprites/generate-intro.py : ne pas modifier à la main.',
        "export const INTRO_SHEET = 'assets/sprites/intro.png';",
        'export const INTRO_SPRITES = {',
    ]
    for name, r in rects.items():
        lines.append(f"  '{name}': [{r[0]}, {r[1]}, {r[2]}, {r[3]}],")
    lines.append('};')
    (ROOT / 'src/intro/sheet.js').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(out, out.stat().st_size, 'octets ;', len(rects), 'sprites')


if __name__ == '__main__':
    build()
