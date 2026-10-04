#!/usr/bin/env python3
"""Génère la planche de l'accompagnement (« Joseph vous montre ») : assets/sprites/coach.png (planche « coach »).

Contenu : docs/ARCHITECTURE.md, « Accompagnement — contrats », sous-section « Sprites » ; docs/ACCOMPAGNEMENT.md § 4.6
(le doigt : toucher, glisser, appui long, pincer ; mouvement réduit : flèche en pointillés).

  coach.hand, coach.hand.1          16 × 16  main gantée claire, index tendu vers le haut-gauche ; .1 : index appuyé
                                             (doigt plus court, petite onde au bout)
  coach.hand.press                  16 × 16  index appuyé, cercle pointillé autour du bout du doigt (le remplissage
                                             du cercle est dessiné par le code)
  coach.hand.pinch, .pinch.1        24 × 16  pouce et index rapprochés / écartés
  coach.arrow                        8 × 8   petite flèche vers la DROITE (le code la tourne dans le sens du glissé)
  portrait.joseph.point             32 × 32  portrait.joseph (career.png) qui montre du doigt vers le bas

Points chauds (pixels, coin haut-gauche du sprite) : bout de l'index de coach.hand = (2, 1) ; de coach.hand.1 et
coach.hand.press = (3, 3) (centre du cercle pointillé : (3, 3)) ; coach.hand.pinch : milieu des deux bouts = (12, 2) ;
coach.hand.pinch.1 : bouts en (3, 2) et (20, 2), milieu (12, 2) ; coach.arrow : pointe en (7, 3).

Lisibilité (téléphone) : gant blanc, ombre bleutée, contour sombre Kenney (63, 38, 49) de 1 px et une ombre portée
douce (noir à 35 %, décalée de 1 px en bas à droite) : le doigt se lit sur l'herbe, sur la neige (le contour sombre
le détache du blanc) et sur l'interface (parchemin, bois). Manchette dorée (rappelle l'anneau doré de la cible).

Le script :
  1. dessine chaque sprite ;
  2. les range dans la planche coach (placement déterministe) et l'écrit ;
  3. réécrit, dans src/render/atlas.js, le bloc compris entre « // <coach:auto> » et « // </coach:auto> » (le crée
     après « // </valley4:auto> », sinon après « // </valley3:auto> ») et déclare la planche dans SHEETS ;
  4. vérifie qu'aucun nom ne heurte un sprite des autres planches.

Relancer :  python3 assets/sprites/generate-coach.py   (nécessite Pillow)
Planche de contrôle (×6, sur herbe, neige, parchemin, bois et sombre) :
            python3 assets/sprites/generate-coach.py --contact DOSSIER
"""
import sys
sys.dont_write_bytecode = True  # pas de __pycache__ dans assets/sprites

from pathlib import Path
import importlib.util
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

T = 16
SHEET = 'coach'
SHEET_COLS = 6
OUT = g3.OUT                        # contour Kenney (63, 38, 49)
PAL = {
    'w': (255, 255, 255),           # gant
    's': (214, 222, 236),           # gant, ombre douce
    'S': (156, 170, 198),           # gant, ombre franche (plis)
    'y': (253, 190, 83),            # manchette dorée
    'Y': (227, 134, 40),            # manchette, ombre
    'F': (247, 194, 130),           # peau de Joseph (portrait.joseph)
    'G': (225, 154, 101),           # peau, ombre
    'M': (195, 75, 53),             # chemise à carreaux
    'J': (38, 43, 68),              # carreaux sombres
    'L': (170, 44, 35),             # chemise, ombre
    'A': (63, 38, 49),              # contour intérieur (plis des doigts)
}
SHADOW = (20, 14, 24, 90)


def art(rows, w, h, outline=1):
    return g3.art(rows, outline=outline, pal=PAL, w=w, h=h)


def drop_shadow(im):
    """Ombre portée douce (1 px en bas à droite) sous les pixels opaques."""
    out = Image.new('RGBA', im.size)
    sh = Image.new('RGBA', im.size)
    px, spx = im.load(), sh.load()
    for y in range(im.height):
        for x in range(im.width):
            if px[x, y][3] and x + 1 < im.width and y + 1 < im.height:
                spx[x + 1, y + 1] = SHADOW
    out.alpha_composite(sh)
    out.alpha_composite(im)
    return out


# ---------------------------------------------------------------------------
# La main (index vers le haut-gauche). Le contour est ajouté par art() (1 px, 8-voisins).

HAND = """
................
..ww............
..wws...........
...wws..........
...wwws.........
....wws.ww......
....wwwAwws.....
..wwwwwAwwAw....
.wwwwwwAwwAws...
.swwAwwwAAwAs...
..sswAwwwwAAs...
....sswwwwwss...
.....sssssssy...
......yyyyYY....
.......yYYYY....
................
"""

# index appuyé : le doigt rentre d'un pixel (plus court), le bout en (3, 3)
HAND_DOWN = """
................
................
................
...ws...........
...wws..........
....wws.ww......
....wwwAwws.....
..wwwwwAwwAw....
.wwwwwwAwwAws...
.swwAwwwAAwAs...
..sswAwwwwAAs...
....sswwwwwss...
.....sssssssy...
......yyyyYY....
.......yYYYY....
................
"""


def rows_of(src):
    return [r for r in src.strip('\n').split('\n')]


def hand(pressed=False):
    return art(rows_of(HAND_DOWN if pressed else HAND), 16, 16)


def ripple(im, cx, cy, pts):
    """Petite onde blanche cernée de sombre autour du bout du doigt."""
    px = im.load()
    for (dx, dy) in pts:
        x, y = cx + dx, cy + dy
        if 0 <= x < im.width and 0 <= y < im.height and not px[x, y][3]:
            px[x, y] = PAL['w'] + (255,)
    for (dx, dy) in pts:
        x, y = cx + dx, cy + dy
        for (ex, ey) in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            q = (x + ex, y + ey)
            if 0 <= q[0] < im.width and 0 <= q[1] < im.height and not px[q][3]:
                px[q] = OUT + (255,)
    return im


def hand_tap():
    im = hand(True)
    # deux arcs : au-dessus et à gauche du bout du doigt (3, 3)
    ripple(im, 3, 3, [(-1, -2), (0, -2), (1, -2), (-2, -1), (-2, 0), (-2, 1)])
    return drop_shadow(im)


def hand_press():
    im = hand(True)
    px = im.load()
    cx, cy, r = 3.5, 3.5, 3.1
    import math
    ring = []
    for k in range(16):
        a = k * math.pi * 2 / 16
        ring.append((int(round(cx + r * math.cos(a) - 0.5)), int(round(cy + r * math.sin(a) - 0.5))))
    # pointillés : un point sur deux, blanc cerné de sombre ; on ne repeint pas la main
    dots = [p for i, p in enumerate(ring) if i % 2 == 0]
    for (x, y) in dots:
        if 0 <= x < 16 and 0 <= y < 16 and not px[x, y][3]:
            px[x, y] = PAL['y'] + (255,)
    for (x, y) in dots:
        for (ex, ey) in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            q = (x + ex, y + ey)
            if 0 <= q[0] < 16 and 0 <= q[1] < 16 and not px[q][3]:
                px[q] = OUT + (255,)
    return drop_shadow(im)


# Pincer : la main vient d'en bas ; l'index (à gauche) et le pouce (à droite) se rapprochent / s'écartent.
PINCH_CLOSED = """
........................
........................
..........ws.ws.........
..........wwAwws........
...........wwAws........
...........wwAws........
..........wwwAwws.......
.........wwwwAwwws......
.........wwAwwwwws......
.........wwAwAwwws......
.........swwAwAwss......
..........ssssssss......
...........yyyyyY.......
...........yYYYYY.......
........................
........................
"""

PINCH_OPEN = """
........................
........................
...ws..............ws...
...wws............wws...
....wws..........wws....
.....wws........wws.....
......wwws....wwws......
.......wwwwwwwwwA.......
........wwAwwwwws.......
........wwAwAwwws.......
........swwAwAwss.......
.........ssssssss.......
..........yyyyyY........
..........yYYYYY........
........................
........................
"""


def pinch(open_):
    return drop_shadow(art(rows_of(PINCH_OPEN if open_ else PINCH_CLOSED), 24, 16))


ARROW = """
........
...w....
...ww...
wwwwsw..
wwwssS..
...sS...
...S....
........
"""


def arrow():
    # flèche à pointe à droite, contour sombre (pas d'ombre : elle est posée en pointillés)
    return art(rows_of(ARROW), 8, 8)


# Joseph qui montre du doigt vers le bas : portrait.joseph + son bras droit levé devant la poitrine, index vers le bas.
JOSEPH_HAND = """
...............
......FFFF.....
MJMMJFFFFFG....
JMMJMFAFAFG....
MMJMJFFFFGG....
LLLLLFFFFGG....
......FFGG.....
......FFG......
......FFG......
.......G.......
"""


def portrait_point():
    career = Image.open(HERE / 'career.png').convert('RGBA')
    p = career.crop((20 * T, 24 * T, 22 * T, 26 * T))
    hand_rows = rows_of(JOSEPH_HAND)
    h = art(hand_rows, 16, 16)
    # la main est posée en bas à gauche du buste ; le bout de l'index touche le bas du cadre
    out = p.copy()
    out.alpha_composite(h, (0, 32 - len(hand_rows) - 2))
    # le bas du cadre reste fermé par le contour (comme le reste du portrait, coupé en bas)
    return out


# ---------------------------------------------------------------------------
# Registre

ENTRIES = []
REAL = {}


def add(name, im):
    assert name not in REAL, name
    REAL[name] = im.size
    w = -(-im.width // T) * T
    h = -(-im.height // T) * T
    if (w, h) != im.size:
        pad = Image.new('RGBA', (w, h))
        pad.alpha_composite(im)
        im = pad
    ENTRIES.append((name, im))


def build():
    add('coach.hand', drop_shadow(hand(False)))
    add('coach.hand.1', hand_tap())
    add('coach.hand.press', hand_press())
    add('coach.hand.pinch', pinch(False))
    add('coach.hand.pinch.1', pinch(True))
    add('coach.arrow', arrow())
    add('portrait.joseph.point', portrait_point())


def pack():
    used = set()
    pos = {}
    order = sorted(range(len(ENTRIES)), key=lambda i: (-(ENTRIES[i][1].width * ENTRIES[i][1].height), i))
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


def _num(v):
    return str(int(v)) if float(v).is_integer() else str(v)


def js_entry(c, r, w, h):
    return f"{{ sheet: '{SHEET}', col: {_num(c)}, row: {_num(r)}" + \
        (f', w: {_num(w)}, h: {_num(h)}' if (w, h) != (1, 1) else '') + ' }'


HEADER = """// Accompagnement (planche « coach », assets/sprites/coach.png) : le doigt de Joseph.
// coach.hand / .1 (16 × 16 : index tendu vers le haut-gauche, bout en (2, 1) ; .1 appuyé avec une onde, bout en (3, 3)),
// coach.hand.press (16 × 16 : appuyé, cercle pointillé centré en (3, 3), remplissage dessiné par le code),
// coach.hand.pinch / .1 (24 × 16 : pouce et index rapprochés, milieu (12, 2) / écartés, bouts (3, 2) et (20, 2)),
// coach.arrow (8 × 8, pointe à DROITE en (7, 3), à tourner), portrait.joseph.point (32 × 32 : montre du doigt en bas).
// Ajoutés à SPRITES ici même (Object.assign), après sa définition."""


def existing_names(src):
    """Noms déclarés ailleurs dans atlas.js (hors bloc coach) : clés littérales et alias écrits en dur."""
    src = re.sub(r'// <coach:auto>\n.*?// </coach:auto>', '', src, flags=re.S)
    names = set(re.findall(r"^\s*'([\w.]+)':", src, re.M))
    names |= set(re.findall(r"SPRITES\['([\w.]+)'\]\s*=", src))
    return names


def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument('--contact', help='dossier où écrire la planche de contrôle ×6')
    args = ap.parse_args()
    build()
    pos, rows = pack()
    sheet = Image.new('RGBA', (SHEET_COLS * T, rows * T))
    for name, im in ENTRIES:
        c, r, w, h = pos[name]
        sheet.alpha_composite(im, (c * T, r * T))
    atlas = ROOT / 'src' / 'render' / 'atlas.js'
    src = atlas.read_text()
    mine = [n for n, _ in ENTRIES]
    clash = sorted(set(mine) & existing_names(src))
    if clash:
        raise SystemExit('noms déjà pris dans atlas.js : ' + ', '.join(clash))
    sheet.save(HERE / 'coach.png', optimize=True)
    lines = [HEADER, '// Généré par assets/sprites/generate-coach.py — ne pas modifier à la main.', 'const coach = {']
    for name, _ in ENTRIES:
        c, r, _w, _h = pos[name]
        rw, rh = REAL[name]
        lines.append(f"  '{name}': {js_entry(c, r, rw / T, rh / T)},")
    lines.append('};')
    lines.append('Object.assign(SPRITES, coach);')
    block = '\n'.join(lines)
    decl = "  coach: 'assets/sprites/coach.png',\n"
    if decl not in src:
        start = src.find('export const SHEETS = {\n')
        end = src.find('\n};', start)
        if start < 0 or end < 0:
            raise SystemExit('SHEETS introuvable dans src/render/atlas.js')
        src = src[:end + 1] + decl + src[end + 1:]          # dernière planche de SHEETS
    if '// <coach:auto>' not in src:
        for anchor in ('// </valley4:auto>\n', '// </valley3:auto>\n'):
            if anchor in src:
                src = src.replace(anchor, anchor + '\n// <coach:auto>\n// </coach:auto>\n', 1)
                break
        else:
            raise SystemExit('marqueur // </valley3:auto> absent de src/render/atlas.js')
    new = re.sub(r'(// <coach:auto>\n).*?(// </coach:auto>)', lambda m: m.group(1) + block + '\n' + m.group(2),
                 src, flags=re.S)
    atlas.write_text(new)
    print(f'écrit {HERE / "coach.png"} ({SHEET_COLS} × {rows} tuiles) : {len(mine)} sprites')
    if args.contact:
        contact(Path(args.contact))


def contact(folder, scale=6):
    """Chaque sprite sur 5 fonds : herbe, neige, parchemin, bois, sombre (×6)."""
    folder.mkdir(parents=True, exist_ok=True)
    bgs = [(132, 198, 105), (240, 244, 250), (238, 214, 170), (150, 96, 62), (43, 38, 51)]
    cell = 34 * scale
    out = Image.new('RGBA', (len(ENTRIES) * cell, len(bgs) * cell), (0, 0, 0, 255))
    for j, bg in enumerate(bgs):
        for i, (name, im) in enumerate(ENTRIES):
            rw, rh = REAL[name]
            tile = Image.new('RGBA', (cell, cell), bg + (255,))
            s = im.crop((0, 0, rw, rh)).resize((rw * scale, rh * scale), Image.NEAREST)
            tile.alpha_composite(s, ((cell - s.width) // 2, (cell - s.height) // 2))
            out.alpha_composite(tile, (i * cell, j * cell))
    out.save(folder / 'coach-contact.png')


if __name__ == '__main__':
    main()
