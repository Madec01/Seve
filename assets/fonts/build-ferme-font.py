"""Construit « Jersey Ferme », la police du jeu (graisses normale et grasse), à partir de Jersey 15
(Sarah Cadigan-Fried, The Soft Type Project, SIL Open Font License 1.1 — voir OFL-Jersey15.txt).

Pourquoi Jersey 15 : l'ancienne police (Pixelify Sans) avait des majuscules ambiguës sur téléphone
(« C » lu « O », « B » lu « G » ou « 8 », « Z » lu « 2 », « D » lu « O »…). Jersey 15 dessine chaque
lettre sur une grille de pixels plus fine (15 pixels de haut pour une majuscule) avec des formes
franches : C ouvert, B et D à angles droits à gauche, Z à barre plate, chiffres distincts des lettres.

Modifications (toutes sur la grille de 50 unités = 1 pixel de la police) :
  1. « I » majuscule avec empattements (barres en haut et en bas) : sans eux, « I » et « l » étaient
     identiques (« Il » illisible). Les I accentués (Ì Í Î Ï Ī Į İ) suivent.
  2. Symboles utilisés par le jeu et absents de la police, dessinés dans le même style :
     → ← ↑ ↓ ↔ ✕ ★ ≥ ≤ ± et les espaces fines (U+2009, U+202F).
  3. Taille : le cadratin passe de 1350 à 1170 unités (lettres ×1,15) pour que, à taille CSS égale,
     les majuscules aient la même hauteur qu'avec l'ancienne police (le texte reste plus étroit).
  4. Instructions de hinting retirées (elles ne correspondent plus aux glyphes modifiés ; le rendu
     sur téléphone se fait sans hinting).
  5. Graisse grasse (700) : chaque glyphe épaissi d'un pixel vers la droite (gras « pixel » classique),
     chasse +1 pixel. La police d'origine n'existe qu'en une graisse.

Usage (depuis la racine du dépôt ; fontTools, brotli et skia-pathops installés) :
  python3 assets/fonts/build-ferme-font.py assets/fonts/Jersey15-Regular.ttf assets/fonts
Produit JerseyFerme-Regular.woff2 et JerseyFerme-Bold.woff2 (les .ttf de travail ne sont pas gardés).
Licence : SIL OFL 1.1 (version modifiée de Jersey 15, pas de nom réservé ; voir CREDITS.md).
"""
import sys
import unicodedata
from fontTools.ttLib import TTFont, newTable
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib.tables.ttProgram import Program
from fontTools.pens.recordingPen import DecomposingRecordingPen
import pathops

SRC = sys.argv[1]
OUT = sys.argv[2]
P = 50            # 1 pixel de la police, en unités
NEW_UPM = 1170    # 1350 → 1170 : glyphes ×1,154

# --- Outils -------------------------------------------------------------------------------------

def rect_path(x0, y0, x1, y1):
    r = pathops.Path()
    r.moveTo(x0, y0); r.lineTo(x1, y0); r.lineTo(x1, y1); r.lineTo(x0, y1); r.close()
    return r

def union(paths):
    out = pathops.Path()
    for p in paths:
        out = pathops.op(out, p, pathops.PathOp.UNION)
    return out

def pix(cells):
    """Rectangles exprimés en pixels (x0, y0, x1, y1) → chemin."""
    return union([rect_path(x0 * P, y0 * P, x1 * P, y1 * P) for (x0, y0, x1, y1) in cells])

def bitmap(rows, x0=1, y_top=None):
    """Dessin en texte : une ligne par rangée de pixels, '#' = plein. y_top = rangée du haut (en pixels)."""
    cells = []
    for r, line in enumerate(rows):
        y = y_top - r - 1
        for c, ch in enumerate(line):
            if ch == '#':
                cells.append((x0 + c, y, x0 + c + 1, y + 1))
    return pix(cells)

def glyph_path(font, name):
    gs = font.getGlyphSet()
    pen = DecomposingRecordingPen(gs)
    gs[name].draw(pen)
    path = pathops.Path()
    pen.replay(path.getPen())
    return path

def translate(path, dx, dy=0):
    out = pathops.Path()
    pen = out.getPen()
    for verb, pts in path:
        pts = [(x + dx, y + dy) for (x, y) in pts]
        if verb == pathops.PathVerb.MOVE: pen.moveTo(*pts)
        elif verb == pathops.PathVerb.LINE: pen.lineTo(*pts)
        elif verb == pathops.PathVerb.QUAD: pen.qCurveTo(*pts)
        elif verb == pathops.PathVerb.CUBIC: pen.curveTo(*pts)
        elif verb == pathops.PathVerb.CLOSE: pen.closePath()
    return out

def set_glyph(font, name, path, advance):
    path = pathops.simplify(path, clockwise=True)  # TrueType : contours extérieurs en sens horaire
    pen = TTGlyphPen(font.getGlyphSet())
    path.draw(pen)
    g = pen.glyph()
    glyf = font['glyf']
    if name not in glyf:
        order = font.getGlyphOrder() + [name]
        font.setGlyphOrder(order)
    glyf[name] = g
    g.recalcBounds(glyf)
    font['hmtx'][name] = (advance, g.xMin if g.numberOfContours else 0)

def map_char(font, cp, name):
    for t in font['cmap'].tables:
        if t.isUnicode():
            if cp > 0xFFFF and t.format == 4:
                continue
            t.cmap[cp] = name

# --- 1. « I » à empattements --------------------------------------------------------------------

def redraw_I(font):
    # Ancien I : barre de 3 px (x 1–4), chasse 5 px. Nouveau : empattements de 7 px × 3 px, fût de 3 px.
    new_I = pix([(1, 0, 8, 3), (3, 3, 6, 12), (1, 12, 8, 15)])
    old_rect = rect_path(1 * P, 0, 4 * P, 15 * P)
    adv = 9 * P
    dx = (4.5 - 2.5) * P   # recentrage des accents (centre 2,5 px → 4,5 px)
    cmap = font.getBestCmap()
    for cp, name in sorted(cmap.items()):
        ch = chr(cp)
        base = unicodedata.normalize('NFD', ch)[0]
        if base != 'I':
            continue
        if ch == 'I':
            set_glyph(font, name, new_I, adv)
            continue
        accent = pathops.op(glyph_path(font, name), old_rect, pathops.PathOp.DIFFERENCE)
        set_glyph(font, name, union([new_I, translate(accent, dx)]), adv)

# --- 2. Symboles manquants ----------------------------------------------------------------------

def arrow_right():
    rows = [
        '........##.....',
        '........###....',
        '.........###...',
        '##############.',
        '###############',
        '##############.',
        '.........###...',
        '........###....',
        '........##.....',
    ]
    return rows


def flip_h(rows):
    return [r[::-1] for r in rows]


def transpose(rows):
    w = max(len(r) for r in rows)
    rows = [r.ljust(w, '.') for r in rows]
    return [''.join(rows[r][c] for r in range(len(rows))) for c in range(w)]


def add_symbols(font):
    right = arrow_right()                   # 15 × 9 px, centré sur y = 7,5 px (axe du « − »)
    left = flip_h(right)
    up = transpose(left)                    # 9 × 15 px (pointe en haut)
    down = up[::-1]
    both = [
        '...##.........##...',
        '..###.........###..',
        '.###...........###.',
        '###################',
        '###################',
        '###################',
        '.###...........###.',
        '..###.........###..',
        '...##.........##...',
    ]
    cross = [                               # ✕ : plus grand et plus net que « × »
        '###.....###',
        '####...####',
        '.####.####.',
        '..#######..',
        '...#####...',
        '..#######..',
        '.####.####.',
        '####...####',
        '###.....###',
    ]
    star = [
        '.......#.......',
        '......###......',
        '......###......',
        '.....#####.....',
        '###############',
        '.#############.',
        '..###########..',
        '...#########...',
        '....#######....',
        '...#########...',
        '...####.####...',
        '..###.....###..',
        '..##.......##..',
    ]
    geq = [
        '###......',
        '#####....',
        '..#####..',
        '....#####',
        '..#####..',
        '#####....',
        '###......',
        '.........',
        '#########',
        '#########',
    ]
    leq = flip_h(geq)
    plusminus = [
        '....###....',
        '....###....',
        '....###....',
        '###########',
        '###########',
        '....###....',
        '....###....',
        '....###....',
        '...........',
        '###########',
        '###########',
    ]
    specs = [
        (0x2192, 'arrowright', right, 17, 3 + 9),
        (0x2190, 'arrowleft', left, 17, 3 + 9),
        (0x2191, 'arrowup', up, 11, 0 + 15),
        (0x2193, 'arrowdown', down, 11, 0 + 15),
        (0x2194, 'arrowboth', both, 21, 3 + 9),
        (0x2715, 'uni2715', cross, 12, 3 + 9),
        (0x2605, 'uni2605', star, 17, 0 + 13),
        (0x2265, 'greaterequal', geq, 10, 0 + 10),
        (0x2264, 'lessequal', leq, 10, 0 + 10),
        (0x00B1, 'plusminus', plusminus, 12, 0 + 11),
    ]
    cmap = font.getBestCmap()
    for cp, name, rows, adv_px, top in specs:
        if cp in cmap:
            continue
        set_glyph(font, name, bitmap(rows, x0=1, y_top=top), adv_px * P)
        map_char(font, cp, name)
    # Espaces fines : 3 px (l'espace normale en fait 5).
    for cp, name in [(0x2009, 'uni2009'), (0x202F, 'uni202F')]:
        if cp not in cmap:
            set_glyph(font, name, pathops.Path(), 3 * P)
            map_char(font, cp, name)

# --- 3–5. Échelle, hinting, gras ---------------------------------------------------------------

def strip_hinting(font):
    for t in ('fpgm', 'prep', 'cvt '):
        if t in font:
            del font[t]
    glyf = font['glyf']
    for name in font.getGlyphOrder():
        g = glyf[name]
        g.expand(glyf)
        if hasattr(g, 'program'):
            g.program = Program()
            g.program.fromBytecode(b'')
    gasp = newTable('gasp')
    gasp.version = 1
    gasp.gaspRange = {0xFFFF: 0x000A}  # lissage à toutes les tailles, sans grille
    font['gasp'] = gasp
    font['maxp'].maxSizeOfInstructions = 0
    font['maxp'].maxFunctionDefs = 0
    font['maxp'].maxInstructionDefs = 0
    font['maxp'].maxStackElements = 0
    font['maxp'].maxTwilightPoints = 0
    font['maxp'].maxStorage = 0
    font['maxp'].maxZones = 1


def embolden(font):
    """Gras « pixel » : union du glyphe et de sa copie décalée d'un pixel vers la droite."""
    glyf = font['glyf']
    hmtx = font['hmtx']
    paths = {}
    for name in font.getGlyphOrder():
        g = glyf[name]
        if g.numberOfContours == 0:
            continue
        p = glyph_path(font, name)
        paths[name] = union([p, translate(p, P)])
    for name in font.getGlyphOrder():
        adv, _ = hmtx[name]
        if name in paths:
            set_glyph(font, name, paths[name], adv + P)
        else:
            hmtx[name] = (adv + P, 0) if adv else (adv, 0)
    # Ancres de marques (GPOS mark) : décalées d'un demi-pixel, c'est négligeable.


def rename(font, style, weight):
    fam = 'Jersey Ferme'
    for rec in font['name'].names:
        if rec.nameID in (1, 16):
            rec.string = fam
        elif rec.nameID in (2, 17):
            rec.string = style
        elif rec.nameID == 4:
            rec.string = f'{fam} {style}'
        elif rec.nameID == 6:
            rec.string = f'JerseyFerme-{style}'
        elif rec.nameID == 3:
            rec.string = f'JerseyFerme-{style};modified-from-Jersey15-1.001'
    font['OS/2'].usWeightClass = weight
    if weight >= 700:
        font['OS/2'].fsSelection = (font['OS/2'].fsSelection & ~0x40) | 0x20  # BOLD, pas REGULAR
        font['head'].macStyle |= 0x01


def build(bold):
    font = TTFont(SRC)
    strip_hinting(font)
    redraw_I(font)
    add_symbols(font)
    if bold:
        embolden(font)
    font['head'].unitsPerEm = NEW_UPM
    style, weight = ('Bold', 700) if bold else ('Regular', 400)
    rename(font, style, weight)
    font['hhea'].advanceWidthMax = max(a for a, _ in font['hmtx'].metrics.values())
    font.flavor = 'woff2'
    font.save(f'{OUT}/JerseyFerme-{style}.woff2')
    print(style, 'OK', len(font.getGlyphOrder()), 'glyphes')


build(False)
build(True)
