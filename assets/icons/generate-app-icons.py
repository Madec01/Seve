#!/usr/bin/env python3
"""Génère les icônes de l'application (PWA, favicon, apple-touch-icon) dans assets/icons/.

Composition « pixel art » à partir des sprites Kenney Tiny Farm (CC0) : une grosse carotte
tout juste arrachée et un tournesol, sur une butte d'herbe, devant un ciel chaud avec un soleil.
La scène est dessinée sur une petite grille (1 unité = 1 pixel Kenney) puis agrandie au plus
proche voisin, avec un facteur entier : les pixels restent nets à toutes les tailles.

Sorties :
  icon-192.png, icon-512.png            « any » : badge carré arrondi (coins transparents)
  icon-maskable-192.png, -512.png      « maskable » : fond plein, motif dans la zone sûre (80 %)
  icon-monochrome-512.png              « monochrome » : silhouette blanche sur transparent
  apple-touch-icon.png (180)           fond plein (iOS arrondit lui-même)
  favicon-32.png, favicon-48.png       favicons
Usage : python3 assets/icons/generate-app-icons.py (depuis n'importe où).
"""
from pathlib import Path
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
FARM = Image.open(ROOT / 'assets/sprites/tiny-farm.png').convert('RGBA')

OUTLINE = (63, 38, 49, 255)       # contour Kenney (= theme_color)
SKY = [(255, 236, 190, 255), (255, 222, 160, 255), (255, 205, 140, 255), (250, 185, 125, 255)]
SUN = (253, 220, 0, 255)
SUN_RIM = (255, 182, 0, 255)
GRASS = (132, 198, 105, 255)
GRASS_DARK = (78, 151, 76, 255)
GRASS_LIGHT = (198, 229, 141, 255)
SOIL = (207, 130, 84, 255)
SOIL_DARK = (186, 102, 42, 255)


def tile(col, row):
    return FARM.crop((col * 16, row * 16, col * 16 + 16, row * 16 + 16))


def thin(img):
    """Les icônes Kenney ont un épais « autocollant » sombre : on ne garde qu'un contour d'1 pixel
    (pixels sombres voisins, en 8-connexité, d'un pixel coloré)."""
    out = img.copy()
    w, h = img.size
    dark = lambda p: p[3] and p[:3] == OUTLINE[:3]
    color = lambda x, y: 0 <= x < w and 0 <= y < h and img.getpixel((x, y))[3] and not dark(img.getpixel((x, y)))
    for y in range(h):
        for x in range(w):
            if dark(img.getpixel((x, y))) and not any(color(x + i, y + j) for i in (-1, 0, 1) for j in (-1, 0, 1)):
                out.putpixel((x, y), (0, 0, 0, 0))
    return out


CARROT = thin(tile(8, 0))      # carotte récoltée (grande icône)
SUNFLOWER = thin(tile(11, 6))  # tournesol mûr


def scene(n):
    """Scène de n × n unités (n ≥ 24), motif centré dans les 24 × 24 unités du milieu."""
    img = Image.new('RGBA', (n, n), SKY[0])
    d = ImageDraw.Draw(img)
    o = (n - 24) // 2  # décalage du motif
    # Ciel en bandes (dégradé pixel art), du haut vers la ligne d'horizon
    horizon = o + 17
    bands = len(SKY)
    for y in range(n):
        k = min(bands - 1, max(0, (y - o + 2) * bands // 19))
        d.line([(0, y), (n - 1, y)], fill=SKY[k])
    # Soleil (disque de 8 unités) en haut, entre les deux plantes
    cx, cy, r = o + 12, o + 4, 4
    for y in range(n):
        for x in range(n):
            dd = (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2
            if dd <= r * r:
                img.putpixel((x, y), SUN if dd <= (r - 1.2) ** 2 else SUN_RIM)
    # Butte d'herbe arrondie + herbe pleine en dessous
    for y in range(horizon - 2, n):
        for x in range(n):
            dx = (x + 0.5 - (o + 12)) / 15.0
            top = horizon - 2 + int(round(3 * dx * dx))
            if y > top:
                img.putpixel((x, y), GRASS)
            elif y == top:
                img.putpixel((x, y), GRASS_LIGHT)
    # Touffes d'herbe foncées
    for (x, y) in [(o + 2, horizon + 3), (o + 3, horizon + 4), (o + 20, horizon + 4), (o + 21, horizon + 3)]:
        if 0 <= x < n and 0 <= y < n:
            img.putpixel((x, y), GRASS_DARK)
    # Trou de terre sous la carotte
    for y in range(horizon + 3, horizon + 6):
        for x in range(o + 12, o + 23):
            dx = (x + 0.5 - (o + 17.5)) / 5.5
            dy = (y + 0.5 - (horizon + 4.5)) / 1.6
            if dx * dx + dy * dy <= 1:
                img.putpixel((x, y), SOIL_DARK if dy < -0.2 else SOIL)
    # Tournesol à gauche, carotte à droite, côte à côte
    img.alpha_composite(SUNFLOWER, (o - 2, o + 6))
    img.alpha_composite(CARROT, (o + 10, o + 6))
    return img


def up(img, s):
    return img.resize((img.width * s, img.height * s), Image.NEAREST)


def fit(size, motif_frac):
    """Scène agrandie d'un facteur entier pour que les 24 unités du motif occupent ≈ motif_frac."""
    s = max(1, int(size * motif_frac // 24))
    n = -(-size // s) + 2
    n += (n % 2)  # pair, pour centrer le motif (24 est pair)
    big = up(scene(n), s)
    off = (big.width - size) // 2
    return big.crop((off, off, off + size, off + size))


def rounded(img, radius_frac=0.18, border_units=None):
    """Badge : coins arrondis transparents + liseré sombre (épaisseur ≈ 1 unité)."""
    size = img.width
    s = max(1, size // 32) if border_units is None else border_units
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=int(size * radius_frac), fill=255)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    frame = Image.new('RGBA', (size, size), OUTLINE)
    out.paste(frame, (0, 0), mask)
    inner = Image.new('L', (size, size), 0)
    ImageDraw.Draw(inner).rounded_rectangle((s, s, size - 1 - s, size - 1 - s), radius=int(size * radius_frac) - s, fill=255)
    out.paste(img, (0, 0), inner)
    # masque binaire (pas d'anticrénelage) pour rester « pixel »
    a = out.getchannel('A').point(lambda v: 255 if v >= 128 else 0)
    out.putalpha(a)
    return out


def monochrome(size):
    """Silhouette blanche (carotte + tournesol) sur fond transparent, motif dans la zone sûre."""
    s = max(1, int(size * 0.62 // 24))
    motif = Image.new('RGBA', (24, 16), (0, 0, 0, 0))
    motif.alpha_composite(SUNFLOWER, (-2, 0))
    motif.alpha_composite(CARROT, (10, 0))
    # le contour sombre devient transparent : il ne reste que les formes intérieures
    a = Image.new('L', motif.size, 0)
    for y in range(motif.height):
        for x in range(motif.width):
            px = motif.getpixel((x, y))
            if px[3] and px[:3] != OUTLINE[:3]:
                a.putpixel((x, y), 255)
    white = Image.new('RGBA', motif.size, (255, 255, 255, 255))
    sil = Image.new('RGBA', motif.size, (0, 0, 0, 0))
    sil.paste(white, (0, 0), a)
    sil = up(sil, s)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.alpha_composite(sil, ((size - sil.width) // 2, (size - sil.height) // 2))
    return out


def main():
    save = lambda im, name: im.save(HERE / name, optimize=True)
    # « any » : le motif occupe presque tout le badge
    for size in (192, 512):
        save(rounded(fit(size, 0.92)), f'icon-{size}.png')
    # « maskable » : motif dans le cercle de 80 % (on vise ≈ 70 % pour la marge)
    for size in (192, 512):
        save(fit(size, 0.68), f'icon-maskable-{size}.png')
    save(monochrome(512), 'icon-monochrome-512.png')
    save(fit(180, 0.85), 'apple-touch-icon.png')
    save(rounded(fit(48, 1.0), 0.18, 1), 'favicon-48.png')
    save(rounded(fit(32, 1.0), 0.18, 1), 'favicon-32.png')
    print('Icônes écrites dans', HERE)


if __name__ == '__main__':
    main()
