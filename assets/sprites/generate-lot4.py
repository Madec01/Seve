#!/usr/bin/env python3
"""Génère assets/sprites/lot4.png : sprites du « lot 4 » (collection et enjeux doux) dans le style Kenney (CC0).

Contenu (voir docs/ARCHITECTURE.md, « Lot 4 — contrats », tableau des sprites, et docs/GAME_DESIGN.md § 17) :
  - album de la ferme : album.cover (32 × 32), icon.album, onglets album.page.<id>, album.empty, tampons
    album.stamp.*, album.ribbon ;
  - produits et poissons manquants : product.wool, fish.<id> (product.milk existe déjà dans career.png) ;
  - hiver vivant : trouvailles winter.<id>, traces track.<id>, 8 oiseaux bird.<id>[.1], mangeoire feeder[.full]
    (16 × 32), window.lit, story.vignette (48 × 32), icônes icon.story / winter / feeder / seedbank / fete / hand ;
  - fêtes : œufs fete.egg.*, lampions, lanternes et grenouilles cachés, marmite fete.pot[.1] (32 × 32), icon.ladle,
    étal fete.stand (32 × 32), rubans ribbon.*, paniers fete.basket[.full], foire aux graines fete.seedstall (32 × 32),
    seedpack.generic, M. le maire npc.mayor[.walk] et la petite Lili npc.lili[.walk] ;
  - lanternes de l'année : lantern.rack (32 × 32), lantern.<critère>.on/off (8 × 8), icon.crit.<critère>,
    icon.lantern.on/off ;
  - « aider sans remplacer » : fx.weeds[.1], badge.waiting (8 × 8) ;
  - 21 décors de l'album decor.* (dont decor.herbarium et decor.lantern.grand en 32 × 32) ;
  - icônes des succès du lot icon.ach.<id> (+ .locked grisée), même médaillon que career.png.

Même méthode que generate-lot3.py (palette Kenney et outils repris de generate-lot2.py / generate-v3.py /
generate-career.py) : dessins ASCII ou construits par programme, contour sombre (63, 38, 49), lumière en haut à
gauche ; 1 px de contour pour les icônes et les petits objets 16 × 16, 2 px pour les grands objets de la scène.

Sprites 8 × 8 : rangés par quatre dans une tuile de 16 px ; leur entrée d'atlas a des col/row demi-entiers et
w = h = 0.5 (drawSprite et spriteSize multiplient simplement par TILE).

Le script :
  1. dessine chaque sprite ;
  2. les range dans la planche (placement automatique, déterministe, 16 tuiles de large) ;
  3. écrit assets/sprites/lot4.png ;
  4. réécrit, dans src/render/atlas.js, le bloc compris entre « // <lot4:auto> » et « // </lot4:auto> ».

Relancer :  python3 assets/sprites/generate-lot4.py   (nécessite Pillow)
Planches de contrôle (×6, avec des originaux) : python3 assets/sprites/generate-lot4.py --contact DOSSIER
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
img, tile, flip, lum = g3.img, g3.tile, g3.flip, g3.lum
V3S, CAS = g2.V3S, g2.CAS
Grid = g2.Grid
over = g2.over
LOT3 = Image.open(HERE / 'lot3.png').convert('RGBA')
L3S = g2.atlas_sprites('lot3', LOT3)

# Palette : celle du lot 2 (Kenney + ajouts carrière / lot 2), les teintes du lot 3 et quelques voisines.
PAL = dict(g2.PAL)
PAL.update({
    # jaune-vert (gui, mousse claire)
    '1': (236, 234, 150),
    '2': (199, 205, 98),
    '3': (146, 160, 64),
    '4': (104, 120, 52),
    # cuivre
    '8': (240, 160, 110),
    '9': (196, 102, 64),
    '0': (140, 66, 46),
    't': (60, 90, 170),      # bleu de l'écharpe tricolore
    '&': (40, 40, 52),       # noir (calottes d'oiseaux, fonte)
    '+': (70, 70, 88),       # noir éclairé
    # cuir vert de l'album
    '<': (110, 168, 92),
    '>': (74, 128, 74),
    '^': (50, 92, 62),
    # neige et ombres bleutées
    '=': (214, 226, 244),
    '-': (168, 186, 220),
    # kraft (sachets de la foire)
    '(': (214, 170, 118),
    ')': (176, 128, 84),
    # pierre chaude (cadran solaire, âtre)
    '[': (210, 200, 186),
    ']': (160, 148, 136),
    # lueur chaude (fenêtre, feu)
    '{': (255, 236, 170),
    '}': (255, 176, 80),
    # violet-lilas (pieds-bleus)
    '/': (196, 168, 214),
    '|': (132, 100, 160),
})

# Verre des lanternes de critère : (clair, moyen, sombre) allumé ; éteint = gris teinté
CRIT_GLASS = {
    'variety': ('j', 'G', 'd'),       # vert
    'care': ('v', 'c', 'C'),          # bleu
    'neighbours': ('K', 'L', 'O'),    # rose
    'beauty': ('i', 'y', 'Y'),        # jaune
    'prosperity': ('r', 'Y', 'o'),    # orange
}
CRITS = list(CRIT_GLASS)
DECOR_LANTERN_COLOR = {'green': 'variety', 'blue': 'care', 'pink': 'neighbours', 'yellow': 'beauty',
                       'orange': 'prosperity'}


def art(rows, outline=2, w=None, h=None, pal=None):
    return g3.art(rows, outline=outline, pal=pal or PAL, w=w, h=h)


def icon(src, pal=None):
    """Icône 16 × 16 au contour fin (1 px), comme assets/sprites/ui/icons.png."""
    rows = rows_of(src)
    assert len(rows) <= 16 and all(len(r) <= 16 for r in rows), src
    return art(rows, outline=1, w=16, h=16, pal=pal)


def rows_of(src):
    return [l for l in src.strip('\n').split('\n')]


def paint(im, rows, x0=0, y0=0):
    """Peint un petit dessin ASCII par-dessus (sans contour ; « . » = inchangé, « _ » = transparent)."""
    px = im.load()
    for y, line in enumerate(rows):
        for x, ch in enumerate(line):
            if ch in '. ':
                continue
            px[x0 + x, y0 + y] = (0, 0, 0, 0) if ch == '_' else (OUT if ch == 'A' else PAL[ch]) + (255,)
    return im


def shift(im, dx, dy):
    out = img(im.width, im.height)
    out.paste(im, (dx, dy), im)
    return out


ellipse = Grid.cells_ellipse.__get__(Grid(1, 1))   # cellules d'une ellipse (fonction libre)


def glow(im, cx, cy, r, color=(255, 226, 140), alpha=120):
    return g2.glow(im, cx, cy, r, color=color, alpha=alpha)


def sparkle(im, x, y, big=False):
    return g2.mini_sparkle(im, x, y, big=big)


def under(im, layer):
    """Pose `layer` sous `im` (ombres, halos)."""
    out = layer.copy()
    out.alpha_composite(im)
    return out


def snow_shadow(w, h, cx, cy, rx, ry, alpha=120):
    """Ombre bleutée ovale (posée sur la neige)."""
    s = img(w, h)
    px = s.load()
    for (x, y) in ellipse(cx, cy, rx, ry):
        if 0 <= x < w and 0 <= y < h:
            d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2
            px[x, y] = (96, 124, 184, alpha if d < 0.55 else alpha * 2 // 3)
    return s


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
    for n, im in ENTRIES:
        if n == name:
            return im
    raise KeyError(name)


# ===========================================================================
# 1. L'album de la ferme

def album_cover():
    """Couverture 32 × 32 : cuir vert, coins dorés, fleur séchée pressée sous un cadre crème."""
    g = Grid(32, 32)
    # tranche des pages (à droite et en bas)
    g.rect(6, 4, 29, 29, 'T')
    for y in range(6, 29, 2):
        g.set(29, y, 'k')
    for x in range(8, 29, 3):
        g.set(x, 29, 'k')
    # plat de la couverture
    g.rect(3, 2, 27, 27, '>')
    g.rect(4, 3, 26, 26, '<')
    for y in range(3, 27):
        g.set(26, y, '>')
    for x in range(4, 27):
        g.set(x, 26, '>')
    # dos (nervures)
    g.rect(3, 2, 6, 27, '^')
    g.rect(4, 2, 5, 27, '>')
    for y in (6, 12, 18, 24):
        g.set(4, y, '<'); g.set(5, y, '<'); g.set(4, y + 1, '^'); g.set(5, y + 1, '^')
    # filet gaufré
    for x in range(9, 24):
        g.set(x, 5, '^'); g.set(x, 24, '^')
    for y in range(5, 25):
        g.set(9, y, '^'); g.set(23, y, '^')
    # coins dorés
    corners = {(7, 2): ['yyyy', 'yiY.', 'yY..', 'y...'],
               (24, 2): ['yyyy', '.iYY', '..YY', '...Y'],
               (7, 24): ['y...', 'yi..', 'yYY.', 'YYYo'],
               (24, 24): ['...Y', '..YY', '.YYo', 'YYoo']}
    for (x, y), pat in corners.items():
        g.stamp(pat, x, y)
    # étiquette crème ovale
    for (x, y) in ellipse(16.5, 14.5, 5.6, 7.4):
        g.set(x, y, 'T')
    for (x, y) in ellipse(16.5, 14.5, 5.6, 7.4):
        if (x + 0.5 - 16.5) / 5.6 + (y + 0.5 - 14.5) / 7.4 > 0.9:
            g.set(x, y, 'l')
    ring = {(x, y) for (x, y) in ellipse(16.5, 14.5, 6.6, 8.4)} - set(ellipse(16.5, 14.5, 5.6, 7.4))
    for (x, y) in ring:
        g.set(x, y, 'Y' if (x + y) % 2 else 'y')
    # fleur séchée pressée : tige, deux feuilles, corolle rose
    for y in range(13, 21):
        g.set(16 + (1 if y > 17 else 0), y, 'J')
    g.stamp(['GG.', '.JG'], 13, 16)
    g.stamp(['.GG', 'GJ.'], 18, 18)
    g.stamp(['.LL.', 'LKpL', 'LpyO', '.LO.'], 15, 9)
    g.set(14, 11, 'L'); g.set(19, 11, 'O')
    im = art(g.rows(), outline=2, w=32, h=32)
    return im


def _icon_album():
    g = Grid(16, 16)
    g.rect(4, 3, 14, 13, 'T')        # pages
    for y in range(4, 13, 2):
        g.set(14, y, 'k')
    g.rect(2, 2, 12, 12, '>')        # plat
    g.rect(3, 2, 12, 11, '<')
    g.rect(2, 2, 3, 12, '^')         # dos
    for y in (4, 7, 10):
        g.set(3, y, '>')
    g.stamp(['...gg', '..gGG', '.gGdG', 'gGdGd', 'GdGd.', '.dd..'], 5, 3)   # feuille pressée
    g.set(5, 9, 'J'); g.set(4, 10, 'J')
    g.stamp(['yy', 'y.'], 10, 2)
    return art(g.rows(), outline=1, w=16, h=16)


ALBUM_PAGE_ICONS = {
    'sky': """
................
........y.......
....y...y...y...
.....y.yyy.y....
.......yiiy.....
...yy.yiiyYY....
......yiyYYW....
.....yyYWWWsW...
....y.WWwwwWWs..
.....WwwwwwwWWs.
....WwwwwwwwWWS.
....WWWWWWWWsSS.
.....SSSSSSSSS..
................
""",
    'luck': """
................
................
.....jj..jj.....
....jjGGjjGG....
....jGGGGGGd....
.....GGdGGd.....
.jjGG.GdGd.jjGG.
.jGGGGddddGGGGd.
..GdGGdddddGGd..
.jGGGGddddGGGGd.
.dGGd.GdGd.dGGd.
.....GGdGGd.....
....jGGGdGGd...d
....dGGddGGd..dd
.....dd..dd.dd..
...........d....
""",
    'village': """
................
.......RR.......
......RrrR..SS..
.....RrrrrR.Ss..
....RrrrrrrRSs..
...RrrrrrrrrR...
..qqqqqqqqqqqq..
...kkkkkkkkkk...
...kccWkkkkkk...
...kcCWknnNkk...
...kWWWknbNkk...
...kkkkknbNkk...
...hhhhhnnNhh...
..ddGGGGGGGGGd..
................
................
""",
    'years': """
................
...S..S..S..S...
..ESEESEESEESE..
..ESEESEESEESE..
..EEEEEEEEEEEE..
..wwwwwwwwwwww..
..wSSwSSwSSwSs..
..wwwwwwwwwwws..
..wSSwRRwSSwSs..
..wwwRRwwwwwws..
..wSSwSSwSSwSs..
..wwwwwwwwwwws..
..sssssssssssS..
................
................
................
""",
    'fetes': """
................
..N.............
..NEEE..........
..NErEEE........
..NErrEEEE......
..NEEEEEEEEq....
..NEEEEEEqq.....
..NqqqEqq.......
..Nqqqq.........
..N.............
..N.............
..N.............
..N.............
.dNd............
dddGd...........
................
""",
    'edge': """
................
................
..........dd....
.....dd..dGDd...
....dGGd.dGGDd..
...dGGGDd.dGGD..
...dDGGd.ddGDd..
....dDd.dDd.dd..
.......nn.......
.dd...nEEq......
dGGd.nEwEqEE....
dDGDnn.EqEEwq...
.dDdn...q.Eqq...
..nn.......q....
.nn.............
................
""",
    'stories': """
................
.......y........
......yiy.......
......yiY.......
.......o........
......wWs.......
......wWs.......
......wWs.......
......wWs.......
......wWs.......
....bwwWsBB.....
...bbbbbbbBB....
..nnnnnnnnnnn...
...NNNNNNNNN....
................
................
""",
}


def album_hen():
    """Poule (onglet « Les animaux ») : poule blanche de profil, crête rouge."""
    return icon("""
................
................
.........ER.....
........EER.....
........wwwy....
.......wwZwyY...
.......wwwwR....
..w....wwwwR....
.wws..wwwww.....
.wwwsswwwwws....
.swwwwwwwwwws...
..swwWwwwWwws...
...sswwwwwss....
.....sssss......
......y..y......
.....yy.yy......
""")


def album_empty():
    """Cadre pointillé crème avec « ? » (case pas encore trouvée), lisible sur le parchemin comme sur l'herbe."""
    im = img(16, 16)
    px = im.load()
    for y in range(2, 14):            # fond crème léger
        for x in range(2, 14):
            px[x, y] = PAL['T'] + (150,)
    pts = []
    for x in range(1, 15):
        if x % 3 != 0:
            pts += [(x, 1), (x, 14)]
    for y in range(2, 14):
        if y % 3 != 0:
            pts += [(1, y), (14, y)]
    for (x, y) in pts:
        px[x, y] = PAL['B'] + (255,)
    q = ['.BBB.', 'BTTTB', 'B..TB', '..TB.', '.TB..', '.....', '.TB..']
    q = ['.BBBB.', 'BB..BB', '....BB', '...BB.', '..BB..', '......', '..BB..']
    for y, line in enumerate(q):
        for x, ch in enumerate(line):
            if ch == 'B':
                px[5 + x, 4 + y] = PAL['B'] + (255,)
    return im


STAMP_INK = {   # encre (claire, foncée)
    'gold': ('y', 'o'),
    'giant': ('G', 'd'),
    'fete': ('r', 'R'),
    'visitor': ('C', 't'),
    'best': ('P', 'Q'),
}
STAMP_MOTIF = {
    'gold': ['....1....', '...121...', '...121...', '111222111', '.1222221.', '..12221..', '..12121..',
             '.121.121.', '.11...11.'],
    'giant': ['....1....', '...121...', '..12221..', '.1222221.', '122222221', '.1222221.', '..12221..',
              '...121...', '....1....'],
    'fete': ['....1....', '....1....', '...121...', '..12221..', '.1222221.', '111111111', '.121.121.',
             '.121.121.', '.111.111.'],
    'visitor': ['.........', '111111111', '112222211', '121222121', '122121221', '122212221', '122222221',
                '111111111', '.........'],
    'best': ['.11...11.', '..11.11..', '...111...', '..11111..', '.1122211.', '.1222221.', '.1122211.',
             '..11111..', '.........'],
}


def album_stamp(kind):
    """Tampon rond encré : anneau épais, motif au centre, encre légèrement irrégulière."""
    light, dark = STAMP_INK[kind]
    im = img(16, 16)
    px = im.load()
    for y in range(16):
        for x in range(16):
            d = math.hypot(x + 0.5 - 8, y + 0.5 - 8)
            if 6.1 <= d <= 7.9:
                k = (x * 7 + y * 13 + len(kind) * 3) % 17
                if k == 0:
                    continue          # petits manques d'encre
                px[x, y] = PAL[dark] + (255 if k % 4 else 200,)
    for y, line in enumerate(STAMP_MOTIF[kind]):
        for x, ch in enumerate(line):
            if ch != '.':
                px[4 + x, 3 + y] = (PAL[dark] if ch == '1' else PAL[light]) + (255,)
    for (x, y) in ((6, 10), (10, 6)):
        if px[x, y][3]:
            px[x, y] = px[x, y][:3] + (190,)
    return im


def album_ribbon():
    """Ruban « page complète » : nœud rouge, deux queues fourchues."""
    return icon("""
................
...EEE....EEE...
..EprEE..EErRq..
..ErrrEEEErRRq..
..EEEEEpERRRRq..
...qqqEwERqqq...
.....EEERq......
....EEq.ERq.....
....EEq..ERq....
...EEq...ERRq...
...EEq....ERq...
..EEq.....ERRq..
..EEq......ERq..
..Eq.Eq...Eq.Rq.
..q...q...q...q.
................
""")


def album_section():
    add('album.cover', album_cover())
    add('icon.album', _icon_album())
    pages = {
        'garden': tile(8, 0),                 # carotte (récolte Tiny Farm)
        'homemade': V3S['product.jam'].copy(),
        'animals': album_hen(),
    }
    for pid in ('garden', 'homemade', 'animals', 'sky', 'luck', 'village', 'years', 'fetes', 'edge', 'feeder',
                'stories'):
        if pid == 'feeder':
            continue   # mésange : alias de bird.blueTit (posé plus bas)
        add(f'album.page.{pid}', pages[pid] if pid in pages else icon(ALBUM_PAGE_ICONS[pid]))
    add('album.empty', album_empty())
    for k in STAMP_INK:
        add(f'album.stamp.{k}', album_stamp(k))
    add('album.ribbon', album_ribbon())


# ===========================================================================
# 2. Produits et poissons manquants

def product_wool():
    """Pelote de laine blanche, fil qui s'échappe."""
    g = Grid(16, 16)
    g.ball(8, 8.5, 5.6, 5.4, 'wWsS', ring=None)
    for (x0, y0, x1, y1) in ((4, 6, 11, 4), (3, 9, 12, 6), (4, 12, 13, 8), (6, 13, 12, 11)):
        g.line(x0, y0, x1, y1, 'S')
    for (x, y) in ((5, 5), (6, 7), (9, 6)):
        g.set(x, y, 'w')
    g.line(12, 13, 14, 14, 's')
    g.set(15, 14, 's'); g.set(14, 15, 'S')
    return art(g.rows(), outline=1, w=16, h=16)


FISH = {
    'gudgeon': """
................
................
................
................
.....S..........
....SsS.........
..SsssssssS..s..
.sWsSssSsssSsSs.
sZsssssssssssSS.
.sWWWWsWWWsWsSs.
..s.ssssssSS.s..
....s...........
................
................
................
................
""",
    'roach': """
................
................
................
......rr........
.....rrr........
...SSSSSSSS.....
..SsssssssssS.r.
.SsEssssssssSrr.
sWWZWWWWWWWWsrr.
.sWWWWWWWWWWsrr.
..sWWWWWWWWs..r.
...ssrsssr......
....r...r.......
................
................
................
""",
    'perch': """
................
................
................
....r.r.r.......
...rrrrrrr......
..jjdjjdjjjj....
.jjwdjjdjjdjj.r.
jjjZdjjdjjdjjrr.
.JJJdJJdJJdJJrr.
..yyyyyyyyyyy.r.
...ryyyr.yyy....
...r....r.......
................
................
................
................
""",
    'trout': """
................
................
................
.......BB.......
......BbbB......
...BbbbNbbbbB...
..BbbNbbbEbbbBB.
.BwbbbbNbbbNbBBB
BbZbLLLLLLLLLbBB
.BbbbbEbbbNbbBBB
..kkkkkkkkkkBB..
....kB...kB.....
................
................
................
................
""",
    'pike': """
................
................
................
................
................
...........dd...
.....GGGGGGdGd..
..GGGgGGGgGGGGd.
GGGZGGGGGGGGGGdd
.GGGGGGGGGGGGGGd
..yyyyyyyyyyGd.d
.....yy...dd....
................
................
................
................
""",
}


def fish_icon(fid):
    return icon(FISH[fid])


def product_section():
    add('product.wool', product_wool())
    for fid in FISH:
        add(f'fish.{fid}', fish_icon(fid))


# ===========================================================================
# 3. L'hiver vivant : trouvailles de lisière, traces, oiseaux, mangeoire, veillée

WINTER_FINDS = {
    'deadwood': """
................
................
................
................
................
..........b.....
.bbbbbbbbbbbbN..
.nnnnnnnknnnnN..
..bbbbbbkbbbbbbN
.nnnnnnnknnnnnN.
bbbbbbbbkbbbbN..
.NNNNNNNkNNNNN..
.......k.k......
................
................
................
""",
    'pinecone': """
................
................
................
................
..........d.....
.....dn..dn.....
....nBnn.nn.....
....BnBn.nBnn...
...nBnBnnBnBnN..
...BnBnNnnBnBN..
...nBnBNBnBnBN..
....NnNNnBnBnN..
.....NN.NnBnN...
.........NNN....
................
................
""",
    'holly': """
................
................
................
................
.....dd.........
....dGGd.dd.....
...dGjGDdGGd....
...DGGGDGjGGd...
....dDGdGGGDd...
.....nddDGDd....
....nEEnndd.....
...nEwEqEE......
...nEEqEwEq.....
....qq.qEEq.....
........qq......
................
""",
    'chestnut': """
................
................
................
................
....3.3...3.....
...3J3.3.3J3....
..3JjJ3.3JjJ3...
..JjJnnBnnJjJ3..
.3JjnBkNBknJJ...
..JJnnNNNnNJJ3..
.3JJJNJJJNJJ3...
..3JJJJJJJJ3.nB.
...3.3J3.3..nkN.
............NN..
................
................
""",
    'blewit': """
................
................
................
................
................
....aa..........
..a/aaa...aa....
.a//aaaa.a/aaa..
.aaaaaa|a//aaa|.
..||/||.aaaaaa|.
....//...||/||..
....//....//....
...///....//....
..........//....
................
................
""",
    'mistletoe': """
................
................
................
................
................
..12.........21.
.1223..3...3221.
..2233.3..3322..
....3233.3323...
...12.3w3w3.21..
..122.ww3ww.221.
...2..3wwW3..2..
.......333......
........3.......
................
................
""",
}


def winter_find(fid):
    im = icon(WINTER_FINDS[fid])
    return under(im, snow_shadow(16, 16, 8, 13.2, 6.5, 2.2))


# Traces dans la neige (gris-bleu, semi-transparentes, sans contour)
TRACKS = {
    'hare': ['................', '..11............', '.1221...........', '.1221..11.......', '.1221.1221......',
             '..11..1221......', '......1221......', '.......11.......', '....1...........', '...121..........',
             '....1...........', '......1.........', '.....121........', '......1.........', '................',
             '................'],
    'deer': ['................', '..........1.1...', '.........12121..', '.........12121..', '.........12221..',
             '..........121...', '................', '................', '......1.1.......', '.....12121......',
             '.....12121......', '.....12221......', '......121.......', '................', '................',
             '................'],
    'fox': ['................', '...........1.1..', '..........1.1.1.', '...........121..', '...........121..',
            '................', '.......1.1......', '......1.1.1.....', '.......121......', '.......121......',
            '................', '...1.1..........', '..1.1.1.........', '...121..........', '...121..........',
            '................'],
}


def track(tid):
    im = img(16, 16)
    px = im.load()
    for y, line in enumerate(TRACKS[tid]):
        for x, ch in enumerate(line):
            if ch == '1':
                px[x, y] = (120, 140, 186, 150)
            elif ch == '2':
                px[x, y] = (86, 104, 152, 190)
    return im


# Oiseaux de la mangeoire : gabarit de profil (bec vers la DROITE), lettres sémantiques
#   H calotte · F face / joue · E œil · K bec · n nuque · B dos · W aile · w barre alaire · X queue
#   T poitrine · t ventre · L pattes ; S = détail propre à l'oiseau (bavette, bandeau, raie…)
BIRD_IDLE = [
    '................',
    '................',
    '................',
    '................',
    '........HHH.....',
    '.......HHHHH....',
    '.......HFEFHKK..',
    '.......nFFFTT...',
    '...XBBBBnFTTT...',
    '..XXBWWWBTTTT...',
    '.XXBBwwwWBTtt...',
    'XX..BBWWWBttt...',
    '.....BBBBttt....',
    '........L.L.....',
    '.......LL.LL....',
    '................',
]
BIRD_PECK = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '.........HHH....',
    '...XBBBBHHHHH...',
    '..XXBWWWBHFEFH..',
    '.XXBBwwwWBFFFKK.',
    'XX..BBWWWBTTtK..',
    '.....BBBBttt....',
    '........L.L.....',
    '.......LL.LL....',
    '................',
]
BIRDS = {   # couleurs des lettres sémantiques ; « marks » : pixels propres (image, x, y, lettre)
    'greatTit': dict(H='&', F='w', E='Z', K='Z', n='&', B='J', W='S', w='w', X='M', T='y', t='i', L='M',
                     marks=[(0, 10, 8, '&'), (0, 10, 9, '&'), (0, 10, 10, '&'), (0, 9, 6, '&'), (0, 7, 6, '&'),
                            (1, 10, 11, '&'), (1, 11, 9, '&')]),
    'blueTit': dict(H='C', F='w', E='Z', K='Z', n='z', B='2', W='C', w='w', X='C', T='y', t='i', L='M',
                    marks=[(0, 7, 6, 'z'), (0, 8, 6, 'z'), (1, 9, 9, 'z'), (1, 10, 9, 'z')]),
    'robin': dict(H='B', F='Y', E='Z', K='Z', n='B', B='B', W='n', w='B', X='n', T='Y', t='W', L='N',
                  marks=[]),
    'sparrow': dict(H='S', F='W', E='Z', K='N', n='n', B='b', W='n', w='w', X='n', T='s', t='W', L='B',
                    marks=[(0, 11, 7, '&'), (0, 10, 8, '&'), (0, 11, 8, '&'), (0, 6, 9, 'N'), (0, 6, 11, 'N'),
                           (1, 12, 11, '&'), (1, 11, 11, '&'), (1, 6, 9, 'N'), (1, 6, 11, 'N')]),
    'chaffinch': dict(H='S', F='L', E='Z', K='s', n='S', B='n', W='&', w='w', X='&', T='L', t='K', L='N',
                      marks=[]),
    'bullfinch': dict(H='&', F='p', E='&', K='&', n='s', B='s', W='&', w='W', X='&', T='p', t='L', L='N',
                      marks=[(0, 11, 6, '&'), (1, 13, 9, '&'), (1, 13, 10, '&')]),
    'nuthatch': dict(H='S', F='w', E='Z', K='M', n='S', B='S', W='M', w='S', X='M', T='f', t='F', L='N',
                     marks=[(0, 7, 6, '&'), (0, 8, 6, '&'), (0, 10, 6, '&'), (0, 11, 6, '&'),
                            (1, 9, 9, '&'), (1, 10, 9, '&'), (1, 12, 9, '&'), (1, 13, 9, '&')]),
    'woodpecker': dict(H='&', F='w', E='Z', K='M', n='E', B='&', W='&', w='w', X='&', T='W', t='E', L='M',
                       marks=[(0, 8, 7, '&'), (0, 9, 7, '&'), (0, 5, 9, 'w'), (0, 6, 9, 'w'),
                              (1, 10, 10, '&'), (1, 11, 10, '&'), (1, 5, 9, 'w'), (1, 6, 9, 'w')]),
}


def bird(bid, frame=0):
    base = BIRD_IDLE if frame == 0 else BIRD_PECK
    c = BIRDS[bid]
    rows = [[('.' if ch == '.' else c.get(ch, ch)) for ch in line] for line in base]
    for (f, x, y, ch) in c['marks']:
        if f == frame:
            rows[y][x] = ch
    return art([''.join(r) for r in rows], outline=1, w=16, h=16)


def bird_section():
    for bid in BIRDS:
        add(f'bird.{bid}', bird(bid, 0))
        add(f'bird.{bid}.1', bird(bid, 1))
    alias('album.page.feeder', 'bird.blueTit')


def feeder(full=False):
    """Mangeoire 16 × 32 : plateau de bois sur un poteau, petit toit enneigé ; graines si `full`."""
    g = Grid(16, 32)
    # poteau
    g.rect(7, 13, 8, 29, 'n')
    for y in range(13, 30):
        g.set(8, y, 'N')
    g.stamp(['.n..n.', 'nN..Nn'], 5, 26)    # jambes de force
    # plateau
    g.rect(1, 11, 14, 13, 'b')
    for x in range(1, 15):
        g.set(x, 11, 'k'); g.set(x, 13, 'B')
    g.set(1, 10, 'b'); g.set(14, 10, 'b')
    # montants du toit
    g.rect(2, 6, 2, 10, 'n'); g.rect(13, 6, 13, 10, 'n')
    # toit à deux pans
    for i in range(6):
        y = 1 + i
        g.rect(7 - i - 1, y, 8 + i + 1, y, 'R')
        g.set(7 - i - 1, y, 'q'); g.set(8 + i + 1, y, 'q')
    g.rect(0, 6, 15, 7, 'q')
    for x in range(0, 16):
        g.set(x, 6, 'R')
    # neige sur le toit
    for i in range(6):
        g.set(7 - i - 1 + 1, 1 + i - 1 if i else 0, 'w')
        g.set(8 + i, 1 + i - 1 if i else 0, 'W')
    g.stamp(['ww', 'wW'], 7, 0)
    g.stamp(['w..', 'Ww.'], 0, 5)
    g.stamp(['..W', '.WW'], 13, 5)
    # neige au pied
    for (x, y) in ellipse(8, 30.5, 6.5, 1.8):
        g.set(x, y, 'w' if y < 30 else '=')
    if full:
        g.stamp(['.y.N.yb.Y.y.', 'yYbyYNyiybYy'], 2, 9)
        g.set(3, 10, 'b')
    im = art(g.rows(), outline=1, w=16, h=32)
    return im


def window_lit():
    """Fenêtre éclairée (lueur chaude orangée, rideaux rouges), posée sur la maison ; halo autour du cadre."""
    g = Grid(16, 16)
    g.rect(3, 2, 12, 12, 'n')
    g.rect(4, 3, 11, 11, '{')
    for y in range(3, 12):
        for x in range(4, 12):
            if x + y > 16:
                g.set(x, y, 'i')
            if x + y > 20:
                g.set(x, y, '}')
    g.set(5, 4, 'w'); g.set(6, 4, 'w'); g.set(5, 5, 'w')
    g.rect(8, 3, 8, 11, 'n')            # croisillons
    g.rect(4, 7, 11, 7, 'n')
    g.stamp(['E', 'R', 'q'], 4, 3)      # rideaux
    g.stamp(['E', 'R', 'q'], 11, 3)
    g.rect(2, 12, 13, 12, 'b')          # appui
    g.rect(2, 13, 13, 13, 'B')
    im = art(g.rows(), outline=1, w=16, h=16)
    return halo_ring(im, (255, 190, 90), (150, 70))


def halo_ring(im, color, alphas):
    """Halo en anneaux autour de la silhouette (1er anneau alphas[0], 2e alphas[1]…), sous l'image."""
    px = im.load()
    W, H = im.size
    filled = {(x, y) for y in range(H) for x in range(W) if px[x, y][3]}
    halo = img(W, H)
    hp = halo.load()
    done = set(filled)
    front = filled
    for a in alphas:
        ring = set()
        for (x, y) in front:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
                q = (x + dx, y + dy)
                if q not in done and 0 <= q[0] < W and 0 <= q[1] < H:
                    ring.add(q)
        for q in ring:
            hp[q] = color + (a,)
        done |= ring
        front = ring
    return under(im, halo)


def story_vignette():
    """La veillée (48 × 32) : Joseph au coin du feu dans son fauteuil, chat roulé en boule, bouilloire."""
    g = Grid(48, 32)
    # mur (lambris sombre) et plancher
    g.rect(0, 0, 47, 22, 'H')
    for x in range(2, 48, 6):
        g.rect(x, 0, x, 21, 'X')
    g.rect(0, 21, 47, 22, 'N')
    g.rect(0, 23, 47, 31, 'n')
    for y in (26, 29):
        g.rect(0, y, 47, y, 'N')
    # cheminée de pierre (à droite)
    g.rect(31, 4, 47, 24, ']')
    for y in range(4, 25):
        for x in range(31, 48):
            if (y % 4 == 0) or ((x + (y // 4) * 3) % 6 == 0):
                g.set(x, y, 'S')
            elif (x + y) % 5 == 0:
                g.set(x, y, '[')
    g.rect(29, 3, 47, 5, 'n')      # manteau de bois
    g.rect(29, 3, 47, 3, 'b')
    g.rect(34, 11, 45, 24, 'X')     # foyer
    g.rect(35, 12, 44, 24, 'H')
    for (x, y) in ellipse(39.5, 21, 5.2, 7.5):
        if 13 <= y <= 23:
            g.set(x, y, 'E')
    for (x, y) in ellipse(39.5, 22, 3.6, 5.5):
        if 15 <= y <= 23:
            g.set(x, y, '}')
    for (x, y) in ellipse(39.5, 22.5, 2.0, 3.6):
        if 18 <= y <= 23:
            g.set(x, y, '{')
    g.stamp(['.E..E.', 'E}.E}E'], 37, 12)
    g.stamp(['bbbN.bbbN', 'NNNN.NNNN'], 35, 23)   # bûches
    # bougie et pot sur le manteau
    g.stamp(['.y.', '.o.', 'wWs'], 31, 0)
    g.stamp(['RR', 'Rq'], 44, 1)
    # bouilloire noire sur l'âtre, à gauche du feu (bec vers le feu), vapeur
    g.rect(30, 25, 47, 26, 'S')           # pierre de l'âtre
    g.rect(30, 25, 47, 25, '[')
    for (x, y) in ellipse(32.5, 23.0, 2.4, 1.9):
        g.set(x, y, 'M' if x < 32 else 'x')
    g.set(31, 22, 'S')
    g.stamp(['.zz.', 'z..z'], 31, 19)
    g.set(35, 22, 'x'); g.set(36, 21, 'x')
    # tableau au mur
    g.rect(15, 4, 23, 10, 'B')
    g.rect(16, 5, 22, 9, 'c')
    g.rect(16, 8, 22, 9, 'G')
    g.set(20, 6, 'y')
    # tapis
    for (x, y) in ellipse(25, 28.5, 13, 2.8):
        g.set(x, y, 'q')
    for (x, y) in ellipse(25, 28.5, 11.4, 1.8):
        g.set(x, y, 'R')
    # fauteuil (dossier à gauche, Joseph regarde le feu à droite)
    g.rect(3, 8, 9, 25, '|')
    g.rect(4, 9, 8, 22, 'Q')
    for (x, y) in ellipse(6, 9, 3.6, 2.4):
        g.set(x, y, 'Q' if y > 7 else 'P')
    g.rect(3, 19, 21, 25, '|')      # assise
    g.rect(4, 19, 20, 21, 'Q')
    g.rect(18, 16, 21, 22, 'Q')     # accoudoir
    g.rect(18, 16, 21, 16, 'P')
    g.rect(21, 16, 21, 25, '|')
    g.rect(4, 26, 4, 27, 'N'); g.rect(20, 26, 20, 27, 'N')
    # Joseph assis de profil (vers la droite) : casquette verte, barbe blanche, chemise à carreaux
    g.stamp(['..JJJJ...', '.JJJJJJ..', 'JJJJJJJdNN', '.ffffff...', '.fWfZff...', '.WWWWfF...',
             '.WWWWWW...', '..WWWW....'], 9, 7)
    for y in range(15, 20):         # buste à carreaux
        for x in range(9, 16):
            g.set(x, y, 'q' if (x % 3 == 0 or y % 3 == 0) else 'R')
    g.rect(10, 19, 22, 21, 'n')     # cuisses
    g.rect(10, 21, 22, 21, 'N')
    g.rect(21, 21, 22, 27, 'n')     # jambes
    g.stamp(['NNNN', 'NNNNN'], 21, 27)
    g.stamp(['wWWw', 'sWWs'], 15, 17)   # livre ouvert
    g.stamp(['ff'], 14, 18); g.set(19, 18, 'f')
    # chat roux roulé en boule sur le tapis (oreilles à droite)
    for (x, y) in ellipse(25, 27.5, 3.8, 2.0):
        g.set(x, y, 'y' if y < 27 else 'Y')
    g.stamp(['Y.Y', 'yyY', 'yZY'], 27, 24)
    g.stamp(['oo', '.o'], 21, 27)
    g.set(24, 26, 'o'); g.set(26, 27, 'o')
    im = art(g.rows(), outline=0, w=48, h=32)
    px = im.load()
    for x in range(48):
        px[x, 0] = OUT + (255,); px[x, 31] = OUT + (255,)
    for y in range(32):
        px[0, y] = OUT + (255,); px[47, y] = OUT + (255,)
    return im


WINTER_ICONS = {
    'story': """
................
..........y.....
.........yiy....
.........yiY....
..........o.....
.........wWs....
.........wWs....
.........wWs....
..nnnnnn.wWs....
.nwwwwwwnwWs....
.nwSSwSwkwWs....
.nwwwwwwnbbbB...
.nwSSwSwkBBBB...
.nwwwwwwkk......
.NNNNNNNNN......
................
""",
    'winter': """
................
.......w........
....w..w..w.....
.....wcwcw......
......cwc.......
..wwcwwWwwcww...
......cwc.......
.....wcwcw......
....w..w..dd....
.......w.dGGd...
........dGjGd...
.......dGGdd.Ed.
........dd..EwE.
...........EEq..
............q...
................
""",
    'feeder': """
................
.......ww.......
......wRRw......
.....wRRRRw.....
....wRRRRRRW....
...RRRRRRRRRR...
...qqqqqqqqqq...
....n......n....
....n......n....
..bkkkkkkkkkkb..
..byYbyNyYbYyb..
..BBBBBBBBBBBB..
.......nN.......
.......nN.......
......nnNN......
................
""",
    'seedbank': """
................
................
..ZZZZZZZZZZZZ..
.ZCCCCCCCCCCCCZ.
.ZccccccccccccZ.
.ZZZZZZZZZZZZZZ.
..CCCCCCCCCCCC..
..CwwwwwwwwwwC..
..CwpyGGpyGGwu..
..CwGdpyGdpywu..
..Cwwwwwwwwwwu..
..CCCCCCCCCCCu..
..uuuuuuuuuuuu..
................
................
................
""",
    'fete': """
................
.N..............
.NEEE...........
.NErEEE.........
.NErrEEEE.......
.NEEEEEEEq......
.NEEEEEqq.......
.NqqqEq.........
.Nqqq...........
.N..............
.N...yy..CC..GG.
.N.NNyyNNCCNNGGN
.N...Yo..Cu..Gd.
.N....o...u...d.
dNd.............
................
""",
    'hand': """
................
.......jj.jj....
......jGGjGGd...
......jGGGGGd...
.......GGGGd....
........GGd.....
....f....d......
...fFf.ff.......
...fFf.fFf.ff...
...fFfffFffFf...
.ff.fFfFfFfFf...
.fFffFfFfFfFf...
..fFFffffffFf...
...ffFFFFFFFf...
....ffFFFFFf....
.....FFFFFF.....
""",
}


def winter_section():
    for fid in WINTER_FINDS:
        add(f'winter.{fid}', winter_find(fid))
    for tid in TRACKS:
        add(f'track.{tid}', track(tid))
    bird_section()
    add('feeder', feeder(False))
    add('feeder.full', feeder(True))
    add('window.lit', window_lit())
    add('story.vignette', story_vignette())
    for k in ('story', 'winter', 'feeder', 'seedbank', 'fete', 'hand'):
        add(f'icon.{k}', icon(WINTER_ICONS[k]))


# ===========================================================================
# 4. Les fêtes : objets cachés, marmite, étal, rubans, paniers, foire aux graines, maire et Lili

EGG_RAMPS = {   # (reflet, clair, moyen, sombre), motif
    0: ('w', 'K', 'L', 'O'),     # rose rayé
    1: ('w', 'c', 'C', 'u'),     # bleu à pois
    2: ('T', 'i', 'y', 'Y'),     # jaune zigzag
    3: ('w', 'g', 'G', 'd'),     # vert à fleurs
    'gold': ('T', 'i', 'y', 'o'),
}


def egg(kind):
    ramp = EGG_RAMPS[kind]
    g = Grid(16, 16)
    cells = g.ball(8, 9.5, 4.4, 5.6, ''.join(ramp[1:]), ring=None)
    g.set(6, 6, ramp[0]); g.set(6, 7, ramp[0]); g.set(7, 5, ramp[0])
    if kind == 0:       # rayures
        for (x, y) in cells:
            if y in (8, 12):
                g.set(x, y, 'w' if x < 9 else 'W')
            if y == 10:
                g.set(x, y, 'E' if x < 10 else 'q')
    elif kind == 1:     # pois
        for (x, y) in ((6, 9), (9, 8), (10, 11), (7, 12), (5, 11), (9, 13), (11, 9)):
            if (x, y) in cells:
                g.set(x, y, 'w' if x < 9 else 'W')
    elif kind == 2:     # zigzag
        for x in range(4, 13):
            y = 9 + (x % 2)
            if (x, y) in cells:
                g.set(x, y, 'E' if x < 10 else 'q')
            if (x, y + 3) in cells:
                g.set(x, y + 3, 'o')
    elif kind == 3:     # fleurs
        for (cx, cy) in ((6, 9), (10, 11), (7, 13)):
            for (x, y) in ((cx, cy - 1), (cx - 1, cy), (cx + 1, cy), (cx, cy + 1)):
                if (x, y) in cells:
                    g.set(x, y, 'p' if cx < 9 else 'w')
            if (cx, cy) in cells:
                g.set(cx, cy, 'y')
    im = art(g.rows(), outline=1, w=16, h=16)
    if kind == 'gold':
        im = sparkle(im, 13, 4)
        im = sparkle(im, 3, 13)
    return im


def egg_shell():
    """Coquilles éclatées (effet de l'objet trouvé) : deux demi-coquilles et des éclats."""
    return icon("""
................
.....w.......w..
...w....K.......
..........w..K..
................
..wW.wW...KL.KL.
..wwWWsW..KKLLOL
..wwwwWs..KKKLLO
...wwWs....KLLO.
....ss......OO..
................
.K...W....w...L.
......L.........
...w.......K....
................
................
""")


def lampion(lit):
    """Lampion de papier rond, côtes et ficelle ; allumé : lueur jaune à travers le papier."""
    g = Grid(16, 16)
    g.rect(7, 0, 8, 2, 'N')
    g.rect(5, 3, 10, 3, 'N')
    ramp = 'ry}E' if lit else 'rERq'
    cells = g.ball(8, 8.5, 5.2, 4.8, ramp, ring=None)
    if lit:
        for (x, y) in ellipse(7.5, 8, 2.6, 2.4):
            g.set(x, y, '{' if (x + y) % 3 else 'y')
    for (x, y) in cells:   # côtes du papier
        if y in (6, 9, 12) and g.get(x, y) != '{':
            g.set(x, y, 'R' if not lit else 'E')
    g.rect(5, 13, 10, 13, 'N')
    g.rect(7, 14, 8, 15, 'y')
    im = art(g.rows(), outline=1, w=16, h=16)
    if lit:
        im = glow(im, 8, 8.5, 9.5, color=(255, 210, 120), alpha=140)
    return im


WINTER_LANTERN = """
................
.......MM.......
......M..M......
......wwwW......
....wwwwWWWW....
....zMMMMMMz....
.....zggGGz.....
.....zgfGGz.....
.....zgfFGz.....
.....zgFFDz.....
.....zGWWDz.....
.....zGWsDz.....
....zMMMMMMz....
.....zzzzzz.....
................
................
"""


def winter_lantern(lit):
    """Lanterne d'hiver en métal, chapeau enneigé, vitres ; allumée : bougie, flamme et halo."""
    m = {'g': '{', 'G': 'i', 'D': '}', 'f': 'y', 'F': 'w'} if lit else \
        {'g': 's', 'G': 'S', 'D': 'M', 'f': 'S', 'F': 'S'}
    src = ''.join(m.get(ch, ch) for ch in WINTER_LANTERN)
    im = icon(src)
    if lit:
        im = glow(im, 8, 9, 9, color=(255, 214, 130), alpha=140)
    return im


FROG = """
................
................
................
................
................
...ww.....ww....
..wZjw...wZjw...
..GjjGGGGGjjG...
.GjjjjjjjjjjjG..
.GGqqqqqqqqGGG..
..GGGgggggGGd...
.GdGgggggggGdG..
GGdGGgggggGGdGG.
GdddGGGGGGGddddd
.dd.dd...dd.dd..
................
"""
FROG_JUMP = """
................
...ww.....ww....
..wZjw...wZjw...
..GjjGGGGGjjG...
.GjjjjjjjjjjjG..
.GGqqqqqqqqGGG..
..GGgggggggGG...
..GGgggggggGG...
..dGGgggggGGd...
..dGGGGGGGGGd...
.dG.dGGGGGd.Gd..
.Gd..dd.dd..dG..
dG..........Gd..
Gd...........dG.
d.............d.
................
"""


def stew_pot(frame):
    """Grande marmite noire (32 × 32) sur trépied, feu de bois ; image 1 : vapeur et bulles."""
    g = Grid(32, 32)
    # pieds du trépied
    for i in range(9):
        g.set(7 - i // 3, 22 + i, 'M'); g.set(24 + i // 3, 22 + i, 'M')
    # bûches et feu
    g.stamp(['..bbbbbbbbbbbN..', 'bbnnnnnnnnnnnNNN', '.NNNNN....NNNNN.'], 8, 28)
    flames = ['..E.....E....E..', '.EyE...EyE..EyE.', 'EyiyE.EyiyEEyiyE', 'EyiiyEyi{iyyi{yE',
              '.Eyi{yi{{iy{iyE.'] if frame == 0 else \
             ['....E.....E.....', '...EyE...EyE..E.', '.E.yiyE.EyiyEEyE', 'EyEyi{yEyi{iyi{E',
              '.Eyi{{i{{iy{iyE.']
    g.stamp(flames, 8, 23)
    # corps de la marmite (ventru, vu un peu de haut)
    for (x, y) in ellipse(16, 16.5, 11.0, 8.0):
        if y >= 12:
            nx = (x + 0.5 - 16) / 11.0
            g.set(x, y, 'x' if nx < -0.55 else ('+' if nx < 0.2 else '&'))
    for (x, y) in ((8, 15), (8, 16), (9, 14), (9, 17), (10, 14)):
        g.set(x, y, 'S')
    # anses
    g.stamp(['MM', 'M.', 'MM'], 3, 13); g.stamp(['MM', '.M', 'MM'], 27, 13)
    # bord épais (ellipse) et surface de la soupe
    for (x, y) in ellipse(16, 11.5, 12.0, 3.6):
        g.set(x, y, 'S' if y < 11 else 'M')
    for (x, y) in ellipse(16, 11.5, 10.0, 2.4):
        g.set(x, y, 'Y' if (x + 0.5 - 16) > 3 else 'y')
    # légumes qui flottent
    g.stamp(['G', 'd'], 11, 10)
    g.stamp(['rR'], 15, 12)
    g.set(19, 10, 'g'); g.set(20, 10, 'G')
    g.set(13, 12, 'k'); g.set(22, 12, 'r')
    if frame == 1:
        g.stamp(['.w.', 'wiw', '.w.'], 16, 9)
        g.stamp(['w', 'i'], 23, 11)
        g.set(10, 12, 'i')
    im = art(g.rows(), outline=2, w=32, h=32)
    # vapeur (semi-transparente, sans contour)
    px = im.load()
    steam = [(12, 5), (13, 4), (13, 3), (12, 2), (19, 6), (20, 5), (20, 4), (21, 3)] if frame == 0 else \
            [(11, 6), (12, 5), (12, 4), (11, 3), (11, 2), (12, 1), (17, 5), (18, 4), (18, 3), (17, 2), (17, 1),
             (22, 6), (23, 5), (23, 4), (22, 3), (14, 3), (15, 2)]
    for (x, y) in steam:
        px[x, y] = (255, 255, 255, 200)
        if x + 1 < 32 and not px[x + 1, y][3]:
            px[x + 1, y] = (235, 239, 248, 140)
    return im


def ladle():
    return icon("""
................
................
...........nN...
..........nbN...
.........nbN....
........nbN.....
.......nbN......
......nbN.......
....bbbN........
...bkkbbB.......
..bkBBBbB.......
..bBBBBbB.......
..bBBBbBN.......
...BBBBN........
....NNN.........
................
""")


def fete_stand():
    """Étal en bois (32 × 32), auvent rayé vert et blanc, cinq cagettes vides sur le comptoir."""
    g = Grid(32, 32)
    # montants
    g.rect(3, 6, 4, 30, 'n'); g.rect(27, 6, 28, 30, 'n')
    g.rect(4, 6, 4, 30, 'N'); g.rect(28, 6, 28, 30, 'N')
    # fond
    g.rect(5, 10, 26, 19, 'n')
    for y in (12, 15, 18):
        g.rect(5, y, 26, y, 'N')
    # auvent rayé
    for x in range(1, 31):
        c = 'G' if (x // 3) % 2 == 0 else 'w'
        for y in range(3, 8):
            g.set(x, y, c)
        if (x // 3) % 2 == 0:
            g.set(x, 8, 'G'); g.set(x, 9, 'd' if x % 3 == 2 else 'G')
        else:
            g.set(x, 8, 'W')
    for x in range(1, 31):
        if (x // 3) % 2 == 0 and x % 3 == 1:
            g.set(x, 9, '.')
    g.rect(2, 1, 29, 2, 'd')
    g.rect(2, 1, 29, 1, 'G')
    # comptoir
    g.rect(1, 22, 30, 27, 'b')
    g.rect(1, 22, 30, 22, 'k')
    g.rect(1, 27, 30, 27, 'B')
    for x in range(1, 31, 5):
        g.set(x, 24, 'B'); g.set(x + 1, 25, 'B')
    # cinq cagettes vides
    for i in range(5):
        x0 = 2 + i * 6
        g.rect(x0, 16, x0 + 4, 21, 'k')
        g.rect(x0 + 1, 17, x0 + 3, 18, 'H')
        g.rect(x0, 19, x0 + 4, 19, 'B')
        g.rect(x0, 21, x0 + 4, 21, 'B')
        g.set(x0 + 4, 16, 'b'); g.set(x0 + 4, 20, 'b')
    # pieds
    g.rect(2, 28, 3, 30, 'N'); g.rect(28, 28, 29, 30, 'N')
    return art(g.rows(), outline=2, w=32, h=32)


def rosette(kind):
    """Rubans de concours : cocarde plissée et deux queues en V ; or : plus grande, à reflets, étincelle."""
    ramps = {'green': ('g', 'G', 'd', 'D'), 'blue': ('c', 'C', 'u', 't'), 'gold': ('i', 'y', 'Y', 'o')}
    c1, c2, c3, c4 = ramps[kind]
    big = kind == 'gold'
    g = Grid(16, 16)
    # queues (en biais, bout fourchu)
    left = [(6, 9), (6, 10), (5, 11), (5, 12), (4, 13), (4, 14)]
    for (x, y) in left:
        g.set(x, y, c2); g.set(x + 1, y, c3)
        g.set(15 - x, y, c2); g.set(14 - x, y, c3)
    g.set(5, 14, '.'); g.set(10, 14, '.')
    r = 5.4 if big else 4.6
    cy = 6.0
    for (x, y) in ellipse(8, cy, r, r):
        a = math.atan2(y + 0.5 - cy, x + 0.5 - 8)
        g.set(x, y, c2 if int((a + math.pi) / (math.pi / 6)) % 2 else c3)
    for (x, y) in ellipse(8, cy, r - 1.7, r - 1.7):
        g.set(x, y, c1)
    for (x, y) in ellipse(8, cy, r - 2.8, r - 2.8):
        g.set(x, y, c2 if not big else 'y')
    g.set(7, 5, 'w' if not big else 'T')
    if big:
        g.set(6, 5, 'i'); g.set(7, 4, 'i')
    im = art(g.rows(), outline=1, w=16, h=16)
    if big:
        im = sparkle(im, 13, 2)
    return im


def basket(full):
    """Panier d'osier à nœud rouge ; plein : légumes qui dépassent."""
    g = Grid(16, 16)
    # anse
    for (x, y) in ellipse(8, 7.5, 5.6, 6.0):
        d = math.hypot((x + 0.5 - 8) / 5.6, (y + 0.5 - 7.5) / 6.0)
        if d > 0.78 and y < 8:
            g.set(x, y, 'n' if x < 8 else 'N')
    if full:
        g.stamp(['..Gg...', '.GdG.gG', '..dGGd.'], 2, 3)        # fanes de carotte
        g.stamp(['RRR', 'rRq', 'RRq'], 9, 5)                     # tomate
        g.stamp(['.gg', 'gGG', 'gGd'], 4, 6)                     # chou
        g.stamp(['Yy', 'YY'], 7, 6)                              # carotte
        g.set(10, 4, 'd')
    # corps du panier
    for y in range(8, 15):
        inset = (y - 8) // 3
        for x in range(2 + inset, 14 - inset):
            g.set(x, y, 'b' if (x + y) % 2 else 'B')
    g.rect(1, 8, 14, 9, 'n')
    g.rect(1, 8, 14, 8, 'b')
    for x in range(2, 14, 2):
        g.set(x, 11, 'n'); g.set(x + 1, 13, 'n')
    # nœud rouge
    g.stamp(['EE.EE', 'EqEqE', '.qEq.', '.E.E.'], 9, 7)
    return art(g.rows(), outline=1, w=16, h=16)


def seedstall():
    """Étal de la foire aux graines (32 × 32) : sachets kraft suspendus à une ficelle, ardoise « −25 % »."""
    g = Grid(32, 32)
    # potence
    g.rect(2, 3, 3, 30, 'n'); g.rect(3, 3, 3, 30, 'N')
    g.rect(28, 3, 29, 30, 'n'); g.rect(29, 3, 29, 30, 'N')
    g.rect(1, 2, 30, 3, 'n'); g.rect(1, 2, 30, 2, 'b')
    # ficelle et sachets
    for x in range(4, 28):
        g.set(x, 5 + (1 if 8 <= x <= 22 else 0) + (1 if 12 <= x <= 18 else 0), 'k')
    emblems = ['R', 'y', 'G', 'P', 'Y']
    for i, x0 in enumerate((5, 10, 15, 20, 24)):
        ytop = 6 + (1 if 8 <= x0 + 1 <= 22 else 0) + (1 if 12 <= x0 + 1 <= 18 else 0)
        g.set(x0 + 1, ytop, 'S')
        g.rect(x0, ytop + 1, x0 + 3, ytop + 6, '(')
        g.rect(x0 + 3, ytop + 1, x0 + 3, ytop + 6, ')')
        g.rect(x0, ytop + 1, x0 + 3, ytop + 1, ')')
        g.rect(x0, ytop + 3, x0 + 2, ytop + 4, 'w')
        g.set(x0 + 1, ytop + 3, emblems[i])
        g.set(x0 + 1, ytop + 4, 'G' if emblems[i] != 'G' else 'd')
    # comptoir et caisse de sachets
    g.rect(1, 22, 30, 27, 'b')
    g.rect(1, 22, 30, 22, 'k')
    g.rect(1, 27, 30, 27, 'B')
    g.rect(20, 18, 28, 21, 'n')
    for x0 in (21, 24, 27):
        g.rect(x0, 16, x0 + 1, 19, '(')
        g.set(x0 + 1, 16, ')')
    g.rect(20, 18, 28, 18, 'b')
    # ardoise « −25 % »
    g.rect(3, 13, 19, 21, 'n')
    g.rect(4, 14, 18, 20, 'z')
    font = {   # chiffres 3 × 5
        '-': ['...', '...', 'www', '...', '...'],
        '2': ['ww.', '..w', '.w.', 'w..', 'www'],
        '5': ['www', 'w..', 'ww.', '..w', 'ww.'],
        '%': ['w.w', '..w', '.w.', 'w..', 'w.w'],
    }
    x = 4
    for ch in '-25%':
        g.stamp(font[ch], x, 15)
        x += 4
    g.rect(2, 28, 3, 30, 'N'); g.rect(28, 28, 29, 30, 'N')
    return art(g.rows(), outline=2, w=32, h=32)


def seedpack_generic():
    return icon("""
................
................
....))))))))....
...)(((((((()...
...((((((((()...
...(wwwwwww()...
...(wwwGwww()...
...(wwGjGww()...
...(wwwGdww()...
...(wwwdwww()...
...(wwwwwww()...
...((((((((()...
...(()(()(())...
...)))))))))))..
................
................
""")


# M. le maire (16 × 16, gabarit des fermiers) : crâne dégarni aux tempes grises, grosse moustache blanche,
# costume sombre, écharpe tricolore en diagonale, carnet blanc à la main
MAYOR_ROWS = [
    '................',
    '....AAAAAAAA....',
    '...AASSSSSSAA...',
    '..AAWSSSSSSWAA..',
    '..AAWSSSSSSWAA..',
    '..AAWSSSSSSWAA..',
    '..AASSSSSSSSAA..',
    '..AASSESSSESAA..',
    '..AAsWWWWWWsAA..',
    '..AAAssWWssAAA..',
    '.AAAtzwwwwzZAAA.',
    'AAAzztwqzzzZZAAA',
    'AASSzzztwqzZwwAA',
    'AASSAzzzztwqwWAA',
    'AAAAAzzAAzzAAAAA',
    '.AAAAFFAAFFAAAA.',
]
# La petite Lili (gabarit de l'enfant) : couettes blondes à rubans rouges, robe bleue, panier au bras
LILI_ROWS = [
    '................',
    '................',
    '................',
    '.....AAAAAA.....',
    '..AAAARRRRRAAA..',
    '.AqAARRRRRRrAqA.',
    'AqRAARrrrrrrARrA',
    'ARrAASSSSSSAARrA',
    'ARrAASESSESAARrA',
    '.AAAAAssssAAAAA.',
    '..AAACCCCCCAAA..',
    '..ASSCCwwCCSSA..',
    '..AACCCCCCCCAA..',
    '...ACuuuuuuCA...',
    '...AAFFAAFFAA...',
    '....AAAAAAAA....',
]


def mayor(pose='idle'):
    rows = gc.posed(MAYOR_ROWS, pose)
    return gc.person(rows, 0, 'grey', 'fair',
                     extra={'W': PAL['W'], 'w': PAL['w'], 't': PAL['t'], 'q': PAL['E'], 'z': PAL['z'],
                            'Z': PAL['Z'], 'S': PAL['l'], 's': PAL['e']})


def lili(pose='idle'):
    rows = list(LILI_ROWS)
    if pose == 'walk':
        rows = rows[1:14] + ['...AAFFAAAAA....', '...AAAAAAFFAA...', '....AAAAAAAA....']
    im = gc.person(rows, 2, 'blonde', 'fair',
                   extra={'C': PAL['C'], 'u': PAL['u'], 'w': PAL['w'], 'q': PAL['E']})
    # panier au bras (à droite)
    bk = art(['n..n', '.nn.', 'bbbb', 'bBbB', '.BB.'], outline=1, w=16, h=16)
    return over(im, bk, 10, 8 if pose == 'idle' else 7)


def fete_section():
    for k in (0, 1, 2, 3):
        add(f'fete.egg.{k}', egg(k))
    add('fete.egg.gold', egg('gold'))
    add('fete.egg.shell', egg_shell())
    add('fete.lampion', lampion(False))
    add('fete.lampion.lit', lampion(True))
    add('fete.lantern', winter_lantern(False))
    add('fete.lantern.lit', winter_lantern(True))
    add('fete.frog', icon(FROG))
    add('fete.frog.1', icon(FROG_JUMP))
    add('fete.pot', stew_pot(0))
    add('fete.pot.1', stew_pot(1))
    add('icon.ladle', ladle())
    add('fete.stand', fete_stand())
    for k in ('green', 'blue', 'gold'):
        add(f'ribbon.{k}', rosette(k))
    add('fete.basket', basket(False))
    add('fete.basket.full', basket(True))
    add('fete.seedstall', seedstall())
    add('seedpack.generic', seedpack_generic())
    add('npc.mayor', mayor('idle'))
    add('npc.mayor.walk', mayor('walk'))
    add('npc.lili', lili('idle'))
    add('npc.lili.walk', lili('walk'))


# ===========================================================================
# 5. Les lanternes de l'année

# Porte-lanternes : 5 montants (un par critère), 4 crochets chacun. Coin haut-gauche de la lanterne 8 × 8
# accrochée au crochet (montant m = 0..4, rang r = 0..3) : x = RACK_X0 + 6 × m, y = RACK_Y0 + 7 × r.
RACK_X0, RACK_Y0 = 1, 3


def lantern_rack():
    g = Grid(32, 32)
    g.rect(0, 0, 31, 2, 'n')                  # traverse haute (petit toit)
    g.rect(0, 0, 31, 0, 'b')
    g.rect(0, 2, 31, 2, 'N')
    for m in range(5):
        cx = RACK_X0 + 6 * m + 3               # milieu de la lanterne
        g.rect(cx, 3, cx, 28, 'n')
        for r in range(4):
            y = RACK_Y0 + 7 * r
            g.set(cx + 1, y, 'S'); g.set(cx + 1, y + 1, 'M')   # crochet
    g.rect(0, 28, 31, 29, 'n')                # traverse basse (marche du perron)
    g.rect(0, 28, 31, 28, 'b')
    g.rect(1, 30, 2, 31, 'N'); g.rect(29, 30, 30, 31, 'N')
    return art(g.rows(), outline=1, w=32, h=32)


def small_lantern(crit, on):
    """Lanterne 8 × 8 (contour compris) accrochée : anse, chapeau, verre coloré, socle."""
    c1, c2, c3 = CRIT_GLASS[crit]
    if not on:
        # éteinte : verre teinté assombri (même couleur, plus sombre)
        c1, c2, c3 = c3, c3, 'M'
    rows = [
        '...AA...',
        '..ANNA..',
        '.AgGGGA.',
        '.AwgGdA.',
        '.AgGGdA.',
        '.AGddDA.',
        '..ANNA..',
        '...AA...',
    ]
    m = {'g': c1, 'G': c2, 'd': c3, 'D': c3, 'w': 'w' if on else c2}
    im = img(8, 8)
    px = im.load()
    for y, line in enumerate(rows):
        for x, ch in enumerate(line):
            if ch == '.':
                continue
            col = OUT if ch == 'A' else PAL[m.get(ch, ch)]
            px[x, y] = col + (255,)
    if on:
        # halo : coins et bords libres
        halo = img(8, 8)
        hp = halo.load()
        hc = PAL[c1]
        for (x, y) in ((1, 1), (6, 1), (0, 3), (7, 3), (0, 4), (7, 4), (1, 6), (6, 6), (2, 0), (5, 0), (2, 7),
                       (5, 7)):
            hp[x, y] = hc + (120,)
        im = under(im, halo)
    return im


CRIT_ICONS = {
    'variety': """
................
................
.......jj.......
......jGGd......
......jGGd......
.jj...jGGd...jj.
.jGGd.jGGd.jGGd.
..jGGdjGGdjGGd..
...jGGdGGdGGd...
....jGdGdGGd....
.....dddddd.....
.......nn.......
.......nn.......
.......nN.......
................
................
""",
    'care': """
................
.......c........
......vc........
......vcC.......
.....vccCC......
.....vccCC......
....vcccCCu.....
....vwccCCu.....
....vwccCCu.....
.....vccCu.pp.pp
......CCu.pLpLLO
...........LLLLO
............LLO.
.............O..
................
................
""",
    'neighbours': """
................
.......pp.pp....
......pLLpLLO...
......LLLLLLO...
.......LLLLO....
....RR..LLO.RR..
...RrrR..O.RrrR.
..RrrrrR..RrrrrR
..qqqqqq..qqqqqq
...kkkk....kkkk.
...kcnk....knck.
...kcnk....knck.
...hhhh....hhhh.
..dGGGGGGGGGGGGd
................
................
""",
    'beauty': """
................
......pp........
.....pLLp.pp....
.....pLLppLLp...
...pp.pLyyLLp...
..pLLpLyiyyp....
..pLLLyiiyYLpp..
...ppLyyyYYLLLp.
....pLLyYYLpLLp.
....pLLpLLp.pp..
.....pp.pp......
........dd......
.......dGd.Gd...
.....GGdd.GGd...
......Gdd.......
................
""",
    'prosperity': """
................
................
.........yyy....
........yiyyY...
........yyyYo...
........iyyYo...
....yyy.yyYYo...
...yiyyYiyyYo...
...yyyYoyyyYo...
...iyyYoiyyYo...
...yyyYoyyyYo...
...iyyYoiyyYo...
...yyyYoyyyYo...
....YYo..YYo....
................
................
""",
}


def big_lantern_icon(on):
    """Lanterne 16 × 16 pour les lignes de l'interface : allumée (halo) / éteinte (grise)."""
    g = Grid(16, 16)
    g.stamp(['.NN.', 'N..N'], 6, 0)
    g.rect(5, 2, 10, 3, 'N')
    glass = ('{', 'y', '}') if on else ('s', 'S', 'M')
    g.rect(4, 4, 11, 11, glass[1])
    g.rect(4, 4, 6, 7, glass[0])
    g.rect(10, 8, 11, 11, glass[2])
    if on:
        g.stamp(['.w.', 'w{w', '.y.'], 6, 6)
    g.rect(4, 4, 4, 11, 'N'); g.rect(11, 4, 11, 11, 'N')
    g.rect(5, 12, 10, 13, 'N')
    g.set(7, 14, 'y' if on else 'S'); g.set(8, 14, 'Y' if on else 'M')
    im = art(g.rows(), outline=1, w=16, h=16)
    if on:
        im = glow(im, 8, 8, 9, color=(255, 214, 130), alpha=140)
    return im


def lantern_section():
    add('lantern.rack', lantern_rack())
    for crit in CRITS:
        add8(f'lantern.{crit}.on', small_lantern(crit, True))
        add8(f'lantern.{crit}.off', small_lantern(crit, False))
    for crit in CRITS:
        add(f'icon.crit.{crit}', icon(CRIT_ICONS[crit]))
    add('icon.lantern.on', big_lantern_icon(True))
    add('icon.lantern.off', big_lantern_icon(False))


# ===========================================================================
# 6. « Aider sans remplacer » (carrière, F1)

def weeds(frame):
    if frame == 0:
        return icon("""
................
................
................
................
........y.......
....j...G...y...
....G..jG..jG...
.y..Gj.GG.jG....
.G..jG.Gd.Gd..j.
..G.GGjGdjGd.jG.
..GjGdGdGGdGjGd.
...GGdGddGdGGd..
....dGddddGdd...
.....dddddd.....
................
................
""")
    im = icon("""
................
...y............
...G.y..........
....GG..j.......
..j.jG.jG.......
...GjGGG.jG.....
.y..GGdGjG......
..GjGdGddG......
...GGddGdd......
....dGdddd......
....nNdnNd......
...n.nN.nN......
..n..n...n......
.....n..........
................
................
""")
    for (x, y) in ((12, 3), (14, 7), (12, 11)):      # mottes de terre qui volent
        paint(im, ['A.', 'BA', 'nA'][:1], x, y)
        paint(im, ['nB', 'BN'], x, y)
    return im


def badge_waiting():
    rows = [
        '.AA.AA..',
        'AjwAjjA.',
        'AjjjjDA.',
        'AjjjjDA.',
        '.AjDDA..',
        '..AdA...',
        '...A....',
        '........',
    ]
    im = img(8, 8)
    px = im.load()
    for y, line in enumerate(rows):
        for x, ch in enumerate(line):
            if ch != '.':
                px[x, y] = (OUT if ch == 'A' else PAL[ch]) + (255,)
    return im


def helpers_section():
    add('fx.weeds', weeds(0))
    add('fx.weeds.1', weeds(1))
    add8('badge.waiting', badge_waiting())


# ===========================================================================
# 7. Les décors de l'album

DECOR_ICONS = {
    'scarecrow.flower': """
................
.....pyw.Ep.....
....pEyyyyywp...
.....kkkkkk.....
.....kZkkZk.....
.....kkkkkk.....
......kRRk......
...y.CCCCCC.y...
..yyCCwCCCCCyy..
...yCCCCCwCC.y..
.....CCCCCC.....
.....CuCCCu.....
.......nn.......
.......nn.......
.......nn.......
......dnnd......
""",
    'barrow.giant': """
................
......dN........
....YYYdYYY.....
...YyyYYyyYo....
..YyiyYyiyYYo...
..YyyyYyyyYYo...
..YYyyYyyYYoo...
...YYYYYYYoo....
.nnnnnnnnnnnnnnS
..nBBBBBBBBBn.S.
...nBBBBBBBn....
....nnnnnnn.....
.....SS..nn.....
....SMMS.n......
....SMMS........
.....SS.........
""",
    'jam.shelf': """
................
................
.nnnnnnnnnnnnnn.
.NNNNNNNNNNNNNN.
..wEw.wEw.wEw...
..RRR.QQQ.YYY...
..RwR.QwQ.YwY...
..RRR.QQQ.YYY...
.bbbbbbbbbbbbbb.
.nnnnnnnnnnnnnn.
..N.wEw.wEw..N..
..N.YYY.RRR..N..
..N.YwY.RwR..N..
..N.YYY.RRR..N..
.bbbbbbbbbbbbbb.
.nnnnnnnnnnnnnn.
""",
    'weathervane.pig': """
................
...O............
..OLO.........O.
...KKLLLLLL..O..
.LKKKKKKKKKL.O..
OKZKKKKKKKKKLO..
OOKKKKKKKKKKLL..
.LKKKKKKKKKLL...
...LLLLLLLLL....
...LO.LO.LO.LO..
.0999999999998..
.......S........
....SS.S.SS.....
.......S........
......nNn.......
.....bnnnN......
""",
    'sundial': """
................
.......Y........
.......YY.......
.......YYo......
...[[[[YYo[[....
.[[[w[[YYo[[w[..
.[[[[[[ooo[[[[].
..]][[[[[[[[]]..
....]]]]]]]]....
......[[]]......
......[[]]......
......[[]]......
.....[[[[]].....
....[[[[[]]]....
...]]]]]]]]]]...
................
""",
    'pump.village': """
................
........+.......
.......+&+......
.......+&&......
..&&&&&+&&......
.&+....+&&......
.......+&&&&&...
.......+&&..&...
.......+&&..+...
.......+&&......
......+&&&&.....
......+&&&&.....
...[[[[[[[[[]...
..[[cccccccc[]..
..[]]]]]]]]]]]..
...]]]]]]]]]]...
""",
    'bunting.post': """
................
..N.............
.bnN............
..nNEEE.........
..nN.EqyyyYY....
..nN..Eq.yYCCC..
..nN......Y..CCu
..nN..........Cu
..nN...EEE......
..nN...rEqGGG...
..nN....Eq.GdYYY
..nN........d.yY
..nN............
..nN............
.dnNd...........
ddGGdd..........
""",
    'arch.fete': """
................
.....pGGGGw.....
...GGdGpGdGGy...
..Gw.........Gp.
..Gd.........dG.
.pG...........G.
.Gd...........dG
.Gy...........Gw
.Gd...........dG
.nN...........nN
.nN...........nN
.nN...........nN
.nN...........nN
.nN...........nN
dnNd........dnNd
................
""",
    'woodpile': """
................
................
................
................
................
......nnnn......
.....nkbbBn.....
....nnbBBBnnn...
...nkbbnnnnkbn..
...nbBBnkbbnBBn.
..nnnnnnbBBnnnn.
.nkbbnnkbbnkbbBn
.nbBBnnbBBnnbBBn
.NnnnNNnnnNNnnnN
.NNNNNNNNNNNNNN.
................
""",
    'heron.wood': """
.........bb.....
........bkbBBBB.
.......nbbB.....
.........bB.....
........bB......
.......bB.......
.......bB.......
........bB......
......bbbbB.....
....bbkbbbB.....
...bbbbbbBB.....
..BBbbbBBB......
.......n........
.......n........
.......nn.......
.....BBBBBB.....
""",
    'rocking.chair': """
................
..nn............
..nbn...........
..nbn...........
..nbn...........
..nbn...........
..nbRR..........
..nbRRRRRRR.....
..nbqqqqqqqn....
..nnnnnnnnnn....
...n.....n.n....
...n.....n.n....
...n.....n..n...
nN.n.....n...n..
.nNNnnnnnnnnnnN.
...NNNNNNNNNN...
""",
}


def woodpile():
    """Tas de bûches : bouts ronds (cernes) empilés en pyramide, joints sombres."""
    g = Grid(16, 16)
    centers = [(3, 12), (7.5, 12), (12, 12), (5.2, 8), (9.8, 8), (7.5, 4.2)]
    g.rect(1, 6, 14, 14, 'H')
    for (x, y) in ellipse(7.5, 10, 7.2, 6.2):
        pass
    hull = set()
    for (cx, cy) in centers:
        hull |= set(ellipse(cx + 0.5, cy + 0.5, 2.6, 2.6))
    for y in range(16):
        for x in range(16):
            if (x, y) not in hull:
                g.set(x, y, '.')
            else:
                g.set(x, y, 'H')
    for (cx, cy) in centers:
        for (x, y) in ellipse(cx + 0.5, cy + 0.5, 2.6, 2.6):
            d = math.hypot(x - cx, y - cy)
            g.set(x, y, 'n' if d > 1.8 else ('k' if d > 0.9 else 'B'))
        g.set(int(cx) - 1, int(cy) - 1, 'l')
    return art(g.rows(), outline=1, w=16, h=16)


def golden_can():
    """Arrosoir doré (même dessin que l'arrosoir du lot 3, recoloré or), étincelles."""
    base = icon("""
................
................
......NNN.......
.....N...N......
....yyyyyyy.....
...yiiiyyyYo..T.
.Y.yiTyyyyYo.yy.
YyYyiyyyyyYoyY..
.YyyiyyyyyYyY...
..YyyyyyyyYY....
...yyyyyyyYo....
...YyyyyyYYo....
....YYYYYYo.....
................
................
................
""")
    im = sparkle(base, 13, 3)
    return sparkle(im, 3, 12)


def fairy_lantern():
    """Lanterne des fées : petite lanterne au bout d'une branche courbée, lueur verte."""
    g = Grid(16, 16)
    g.line(3, 15, 3, 4, 'n')
    g.line(3, 4, 5, 2, 'n')
    g.line(5, 2, 9, 2, 'n')
    g.set(4, 15, 'N'); g.set(2, 15, 'd'); g.set(4, 14, 'd')
    g.set(10, 3, 'S')
    g.rect(9, 4, 11, 4, 'N')
    g.rect(8, 5, 12, 10, 'j')
    g.rect(8, 5, 9, 7, '1')
    g.rect(11, 8, 12, 10, 'G')
    g.set(10, 7, 'w'); g.set(10, 8, '1')
    g.rect(9, 11, 11, 11, 'N')
    g.stamp(['dG', '.d'], 4, 5)
    im = art(g.rows(), outline=1, w=16, h=16)
    im = glow(im, 10, 8, 7.5, color=(170, 240, 150), alpha=150)
    return sparkle(im, 13, 13)


def herbarium():
    """Le grand herbier (32 × 32) : petit kiosque vitré, plantes séchées en cadres."""
    g = Grid(32, 32)
    # socle de pierre
    g.rect(3, 26, 28, 30, ']')
    g.rect(3, 26, 28, 26, '[')
    for x in range(5, 28, 5):
        g.set(x, 28, 'S'); g.set(x + 2, 30, 'S')
    # toit pointu vert-de-gris et épi
    for i in range(9):
        y = 3 + i
        g.rect(16 - 2 - i * 1.5 if False else 15 - int(i * 1.45), y, 16 + int(i * 1.45), y, 'G')
    for y in range(3, 12):
        for x in range(0, 32):
            if g.get(x, y) == 'G' and x > 16:
                g.set(x, y, 'd')
    g.rect(2, 11, 29, 12, 'd')
    g.rect(2, 11, 29, 11, 'G')
    g.stamp(['.y.', 'yiY', '.Y.', '.o.'], 15, 0)
    # cage vitrée
    g.rect(4, 13, 27, 25, 'W')
    for x0 in (5, 11, 17, 23):
        g.rect(x0, 14, x0 + 3, 24, 'c')
        g.rect(x0, 14, x0, 17, 'v')
    # montants blancs
    for x in (4, 10, 16, 22, 27):
        g.rect(x, 13, x, 25, 'w')
    g.rect(4, 19, 27, 19, 'w')
    # cadres de plantes séchées (crème, motif vert) dans les vitres basses
    plants = [['.G.', 'GdG', '.d.'], ['y.y', '.d.', 'GdG'], ['.p.', 'pdp', '.d.'], ['G.G', '.dG', '.d.']]
    for i, x0 in enumerate((5, 11, 17, 23)):
        g.rect(x0, 20, x0 + 3, 24, 'T')
        g.rect(x0, 20, x0 + 3, 20, 'B')
        g.rect(x0, 24, x0 + 3, 24, 'B')
        g.stamp(plants[i], x0, 21)
    # porte au milieu (vitres hautes : feuillage)
    for (x, y) in ((6, 16), (13, 15), (18, 16), (24, 15), (25, 17)):
        g.set(x, y, 'G'); g.set(x, y + 1, 'd')
    return art(g.rows(), outline=2, w=32, h=32)


def post_lantern(crit):
    """Lanterne de critère sur poteau (décor) : verre de couleur, lueur douce."""
    c1, c2, c3 = CRIT_GLASS[crit]
    g = Grid(16, 16)
    g.rect(7, 10, 8, 14, 'n')
    g.rect(8, 10, 8, 14, 'N')
    g.rect(5, 14, 10, 15, 'S')
    g.rect(5, 14, 10, 14, 's')
    g.stamp(['.NN.', 'NNNN'], 6, 1)
    g.rect(5, 3, 10, 8, c2)
    g.rect(5, 3, 6, 5, c1)
    g.rect(9, 6, 10, 8, c3)
    g.set(7, 5, 'w'); g.set(8, 5, c1); g.set(7, 6, c1)
    g.rect(5, 3, 5, 8, 'N'); g.rect(10, 3, 10, 8, 'N')
    g.rect(5, 9, 10, 9, 'N')
    im = art(g.rows(), outline=1, w=16, h=16)
    return glow(im, 8, 5.5, 7.5, color=PAL[c1], alpha=120)


def grand_lantern():
    """Le grand lampion (32 × 32) : lanterne de papier à cinq bandes de couleur sur un mât."""
    g = Grid(32, 32)
    # mât et potence
    g.rect(5, 2, 6, 29, 'n'); g.rect(6, 2, 6, 29, 'N')
    g.rect(5, 2, 22, 3, 'n'); g.rect(5, 2, 22, 2, 'b')
    g.stamp(['.n', 'n.'], 7, 4)
    g.set(18, 4, 'S'); g.set(18, 5, 'S')
    g.rect(3, 29, 8, 31, 'S'); g.rect(3, 29, 8, 29, 's')
    # lampion
    bands = ['G', 'c', 'L', 'y', 'Y']
    lights = {'G': 'j', 'c': 'v', 'L': 'K', 'y': 'i', 'Y': 'r'}
    darks = {'G': 'd', 'c': 'C', 'L': 'O', 'y': 'Y', 'Y': 'o'}
    cx, cy, rx, ry = 18.5, 15.5, 8.0, 9.0
    g.rect(15, 6, 21, 6, 'N')
    for (x, y) in ellipse(cx, cy, rx, ry):
        if not (7 <= y <= 24):
            continue
        b = min(4, (y - 7) * 5 // 18)
        c = bands[b]
        nx = (x + 0.5 - cx) / rx
        ch = lights[c] if nx < -0.35 else (darks[c] if nx > 0.5 else c)
        if abs(nx) < 0.25 and 10 <= y <= 21:
            ch = '{' if abs(nx) < 0.12 else lights[c]
        g.set(x, y, ch)
    g.rect(15, 24, 21, 25, 'N')
    g.stamp(['y', 'Y', 'y', 'Y'], 18, 26)
    im = art(g.rows(), outline=2, w=32, h=32)
    return glow(im, 18.5, 15.5, 14, color=(255, 220, 140), alpha=120)


def decor_section():
    order = ['scarecrow.flower', 'can.golden', 'barrow.giant', 'jam.shelf', 'weathervane.pig', 'sundial',
             'lantern.fairy', 'pump.village', 'bunting.post', 'arch.fete', 'woodpile', 'heron.wood',
             'rocking.chair']
    special = {'can.golden': golden_can, 'lantern.fairy': fairy_lantern, 'woodpile': woodpile}
    for did in order:
        add(f'decor.{did}', special[did]() if did in special else icon(DECOR_ICONS[did]))
    add('decor.herbarium', herbarium())
    for color, crit in DECOR_LANTERN_COLOR.items():
        add(f'decor.lantern.{color}', post_lantern(crit))
    add('decor.lantern.grand', grand_lantern())


# ===========================================================================
# 8. Succès du lot (médaillon doré de career.png + motif)

ACH_MOTIF = {
    'albumPage': ['NNN.NNN', 'NwwNwwN', 'NwSNSwN', 'NwwNwwN', 'NwSNSwN', 'NNNNNNN'],
    'goldenHerbarium': ['....dd', '..dGGd', '.dGjGd', 'dGjGd.', 'dGdd.y', 'n...yi'],
    'albumComplete': ['^>>>>y', '^<<<yy', '^<<<<>', '^<gd<>', '^<<<<>', '^>>>>>'],
    'brightYear': ['y.NN.y', '.NNNN.', 'yN{wNy', '.N{yN.', 'yNYYNy', '..NN..'],
    'allLanterns': ['N.N.N', 'NNNNN', 'G.C.L', 'd.u.O', 'N.N.N'],
    'eggHunter': ['.LL.', 'LKLO', 'EEEE', 'LLLO', 'qqqq', '.OO.'],
    'goldRosette': ['.YoY.', 'YoyoY', 'oyTyo', 'YoyoY', '.EoE.', 'E...E'],
    'birdFriends': ['..CCC.', '.CwZwZ', 'CCwww.', 'CJyyy.', '.Jyy..', '..M.M.'],
    'handPicked500': ['....Gd', '...YGd', '..YYG.', 'FFYYF.', 'FFFFFF', '.FFFF.'],
    'orders50': ['..E..', 'NNNNN', 'NwSwN', 'NwwdN', 'NdwdN', 'NNdNN'],
    'fullCart': ['.RgYr.', 'NNNNNN', 'NBnBnN', 'NNNNNN', '.N..N.'],
    'goldMedals10': ['C...E', '.C.E.', '.oYo.', 'oyiYo', 'oYYYo', '.ooo.'],
}


def ach_icon(motif):
    """Médaillon doré (comme generate-career.py) et motif au centre."""
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

SECTIONS = [album_section, product_section, winter_section, fete_section, lantern_section, helpers_section,
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
    return f"{{ sheet: 'lot4', col: {_num(c)}, row: {_num(r)}" + \
        (f', w: {_num(w)}, h: {_num(h)}' if (w, h) != (1, 1) else '') + ' }'


HEADER = """// Lot 4 (planche « lot4 », assets/sprites/lot4.png) : « collection et enjeux doux » dans le style Kenney.
// Album : album.cover (32 × 32), icon.album, album.page.<id>, album.empty, album.stamp.<gold|giant|fete|visitor|best>,
// album.ribbon ; product.wool, fish.<id> ; hiver : winter.<id>, track.<hare|deer|fox>, bird.<id>[.1] (bec vers la
// DROITE ; .1 = il picore), feeder[.full] (16 × 32), window.lit, story.vignette (48 × 32), icon.story / winter /
// feeder / seedbank / fete / hand ; fêtes : fete.egg.<0..3|gold|shell>, fete.lampion[.lit], fete.lantern[.lit],
// fete.frog[.1], fete.pot[.1] / fete.stand / fete.seedstall (32 × 32), icon.ladle, ribbon.<green|blue|gold>,
// fete.basket[.full], seedpack.generic, npc.mayor[.walk], npc.lili[.walk] (de face, comme npc.joseph) ;
// lanternes : lantern.rack (32 × 32), lantern.<critère>.on/off (8 × 8 : col/row demi-entiers, w = h = 0.5),
// icon.crit.<critère>, icon.lantern.on/off ; F1 : fx.weeds[.1], badge.waiting (8 × 8) ; décors decor.* (dont
// decor.herbarium et decor.lantern.grand en 32 × 32) ; succès icon.ach.<id>[.locked].
// lantern.rack : la lanterne 8 × 8 du crochet (montant m = 0..4, rang r = 0..3) se dessine à
// x = 1 + 6 × m, y = 3 + 7 × r (pixels, à l'intérieur du sprite).
// Ajoutés à SPRITES ici même (Object.assign), après sa définition."""


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
    sheet.save(HERE / 'lot4.png', optimize=True)
    allpos = dict(pos)
    allpos.update(small_pos)
    lines = [HEADER, '// Généré par assets/sprites/generate-lot4.py — ne pas modifier à la main.', 'const lot4 = {']
    for name, _ in ENTRIES + SMALL:
        lines.append(f"  '{name}': {js_entry(*allpos[name])},")
    for name, target in ALIASES:
        lines.append(f"  '{name}': {js_entry(*allpos[target])},")
    lines.append('};')
    lines.append('Object.assign(SPRITES, lot4);')
    block = '\n'.join(lines)
    atlas = ROOT / 'src' / 'render' / 'atlas.js'
    src = atlas.read_text()
    if '// <lot4:auto>' not in src:
        raise SystemExit('marqueurs // <lot4:auto> absents de src/render/atlas.js')
    new = re.sub(r'(// <lot4:auto>\n).*?(// </lot4:auto>)', lambda m: m.group(1) + block + '\n' + m.group(2),
                 src, flags=re.S)
    atlas.write_text(new)
    n = len(ENTRIES) + len(SMALL)
    print(f'écrit {HERE / "lot4.png"} ({SHEET_COLS} × {rows} tuiles, {n} sprites, {len(ALIASES)} alias)')
    if args.contact:
        contact_sheets(Path(args.contact))


def group_of(name):
    if name.startswith(('album.', 'icon.album', 'product.', 'fish.')):
        return 'album'
    if name.startswith(('winter.', 'track.', 'bird.', 'feeder', 'window.', 'story.')):
        return 'winter'
    if name.startswith(('fete.', 'ribbon.', 'seedpack.', 'npc.')):
        return 'fete'
    if name.startswith(('decor.',)):
        return 'decor'
    return 'icons'


def contact_sheets(folder, scale=6):
    """Planches de contrôle : chaque groupe à ×scale, à côté d'originaux (Kenney, v3, carrière, lot 3)."""
    folder.mkdir(parents=True, exist_ok=True)
    refs = {
        'album': [tile(8, 0), V3S['product.jam'], CAS['product.milk'], L3S['medal.gold']],
        'winter': [CAS['npc.joseph'], CAS['bird.crow'], g2.get('owl.carved') if False else tile(0, 9)],
        'fete': [CAS['npc.joseph'], L3S['npc.merchant'], L3S['fair.theme.bees'], CAS['fair.stand']],
        'decor': [V3S['deco.scarecrow'], V3S['deco.lamppost'], L3S['weathervane.rooster'], L3S['lantern.peddler']],
        'icons': [CAS['icon.ach.tractor'], CAS['icon.ach.tractor.locked'], L3S['icon.board'], L3S['icon.cart']],
    }
    groups = {k: [] for k in refs}
    for name, im in ENTRIES:
        groups[group_of(name)].append(im)
    for name, im in SMALL:
        groups['icons'].append(im)
    for key, ims in groups.items():
        for bgname, bg in (('', (132, 198, 105, 255)), ('-parchment', (255, 241, 210, 255)), ('-snow', (235, 240, 250, 255))):
            if bgname == '-parchment' and key not in ('icons', 'album', 'fete'):
                continue
            if bgname == '-snow' and key != 'winter':
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
            out.save(folder / f'lot4-art-contact-{key}{bgname}.png')


if __name__ == '__main__':
    main()
