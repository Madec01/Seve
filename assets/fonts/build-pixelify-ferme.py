"""Construit « Pixelify Sans Ferme » : instances statiques (400, 500, 600, 700) de Pixelify Sans
dont les chiffres 2, 5 et 7 sont redessinés sur la grille de pixels de la police, et sans les
ligatures fi / fl / ff (illisibles).

Pourquoi : dans Pixelify Sans, le « 2 » a un crochet en bas à droite et un bas arrondi (il se lit « 8 »
aux petites tailles), le « 5 » a le haut arrondi (il se lit « S ») et le « 7 » a un crochet à gauche. Les nouveaux glyphes sont
construits avec les bords exacts du « 8 » de chaque graisse, donc même épaisseur et même rythme.

Usage (depuis la racine du dépôt, fontTools, brotli et skia-pathops installés) :
  python3 assets/fonts/build-pixelify-ferme.py assets/fonts/PixelifySans-Variable.ttf assets/fonts
Seuls les .woff2 sont conservés dans le dépôt (les .ttf produits peuvent être supprimés).
Licence : SIL OFL 1.1 (version modifiée de Pixelify Sans, voir OFL.txt et CREDITS.md).
"""
import sys
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.ttGlyphPen import TTGlyphPen
import pathops

SRC = sys.argv[1]; OUT = sys.argv[2]

def edges(font):
    g = font['glyf']['eight']
    coords, ends, _ = g.getCoordinates(font['glyf'])
    pts = list(coords); cs = []; s = 0
    for e in ends: cs.append(pts[s:e+1]); s = e+1
    outer = max(cs, key=len)
    holes = sorted([c for c in cs if c is not outer], key=lambda c: min(p[1] for p in c))
    ox = sorted({p[0] for p in outer}); oy = sorted({p[1] for p in outer})
    h1, h2 = holes
    E = dict(XL0=ox[0], XL1=ox[1], XR1=ox[-2], XR0=ox[-1],
             XHL=min(p[0] for p in h1), XHR=max(p[0] for p in h1),
             YB0=oy[0], YB1=oy[1], YM0=oy[2], YM1=oy[3], YT1=oy[-2], YT0=oy[-1],
             YH1b=min(p[1] for p in h1), YH1t=max(p[1] for p in h1),
             YH2b=min(p[1] for p in h2), YH2t=max(p[1] for p in h2))
    return E

def rects_two(E):
    return [
        (E['XL1'], E['YH2t'], E['XR1'], E['YT0']),                      # barre du haut (coins arrondis)
        (E['XL0'], E['YT1'] - (E['YT0'] - E['YH2t']), E['XHL'], E['YT1']),  # point haut gauche
        (E['XHR'], E['YM1'], E['XR0'], E['YT1']),                       # jambage haut droit
        (E['XL1'], E['YH1t'], E['XR1'], E['YH2b']),                     # barre du milieu
        (E['XL0'], E['YB0'], E['XHL'], E['YM0']),                       # jambage bas gauche (angle droit)
        (E['XL0'], E['YB0'], E['XR0'], E['YH1b']),                      # barre du bas pleine
    ]

def rects_five(E):
    return [
        (E['XL0'], E['YH2t'], E['XR0'], E['YT0']),                      # barre du haut pleine
        (E['XL0'], E['YH1t'], E['XHL'], E['YT0']),                      # jambage haut gauche
        (E['XL0'], E['YH1t'], E['XR1'], E['YH2b']),                     # barre du milieu
        (E['XHR'], E['YB1'], E['XR0'], E['YM0']),                       # jambage bas droit
        (E['XL1'], E['YB0'], E['XR1'], E['YH1b']),                      # barre du bas
        (E['XL0'], E['YB1'], E['XHL'], E['YB1'] + (E['YH1b'] - E['YB0'])),  # point bas gauche
    ]

def rects_seven(E):
    sw = E['XHL'] - E['XL0']                      # épaisseur d'un trait vertical
    mid = (E['XL0'] + E['XR0']) / 2
    return [
        (E['XL0'], E['YH2t'], E['XR0'], E['YT0']),                      # barre du haut pleine
        (E['XHR'], E['YH2b'], E['XR0'], E['YT0']),                      # jambage haut droit
        (E['XHR'] - sw, E['YH1t'], E['XHR'], E['YH2b']),                # marche
        (round(mid - sw / 2), E['YB0'], round(mid + sw / 2), E['YH1t']),  # hampe
    ]

def glyph_from_rects(rects, glyf):
    path = pathops.Path()
    for (x0, y0, x1, y1) in rects:
        r = pathops.Path(); r.moveTo(x0, y0); r.lineTo(x1, y0); r.lineTo(x1, y1); r.lineTo(x0, y1); r.close()
        path = pathops.op(path, r, pathops.PathOp.UNION)
    path.simplify(clockwise=True)  # TrueType : contours extérieurs dans le sens horaire
    pen = TTGlyphPen(glyf)
    path.draw(pen)
    return pen.glyph()

for w, style in [(400, 'Regular'), (500, 'Medium'), (600, 'SemiBold'), (700, 'Bold')]:
    f = TTFont(SRC)
    inst = instantiateVariableFont(f, {'wght': w}, updateFontNames=False)
    E = edges(inst)
    glyf = inst['glyf']
    for name, fn in [('two', rects_two), ('five', rects_five), ('seven', rects_seven)]:
        g = glyph_from_rects(fn(E), glyf)
        glyf[name] = g
        g.recalcBounds(glyf)
        adv, _ = inst['hmtx'][name]
        inst['hmtx'][name] = (adv, g.xMin)
    # Ligatures « fi », « fl », « ff », « ffi », « ffl » désactivées : dans Pixelify Sans elles se lisent
    # « A » (« fin » devenait « Ân »). On vide la fonctionnalité liga (le canevas ne sait pas la couper).
    for fr in inst['GSUB'].table.FeatureList.FeatureRecord:
        if fr.FeatureTag in ('liga', 'dlig'):
            fr.Feature.LookupListIndex = []
            fr.Feature.LookupCount = 0
    # Nom de la police modifiée (OFL : pas de nom réservé, mais on distingue la version modifiée)
    fam = 'Pixelify Sans Ferme'
    for rec in inst['name'].names:
        if rec.nameID in (1, 16): rec.string = fam
        elif rec.nameID in (2, 17): rec.string = style
        elif rec.nameID == 4: rec.string = f'{fam} {style}'
        elif rec.nameID == 6: rec.string = f'PixelifySansFerme-{style}'
        elif rec.nameID == 3: rec.string = f'PixelifySansFerme-{style};modified'
    inst['OS/2'].usWeightClass = w
    for k in ('STAT',):
        if k in inst: del inst[k]
    inst.flavor = 'woff2'
    inst.save(f'{OUT}/PixelifySansFerme-{style}.woff2')
    inst.flavor = None
    inst.save(f'{OUT}/PixelifySansFerme-{style}.ttf')
    print(style, E)
