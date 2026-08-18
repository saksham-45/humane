#!/usr/bin/env python3
"""Build HUMANE logo.gif (letter jitter) and 12 blink avatar GIFs."""

from __future__ import annotations

import os
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
IMG = ROOT / "public" / "img"
AV = ROOT / "public" / "avatars"
INK = (26, 16, 32, 255)

# letter index -> (dx, dy) for frame 2. Keep x almost still; dip/lift y a little.
JITTER = [
    (0, 2),
    (0, -2),
    (1, 1),
    (0, -3),
    (-1, 2),
    (0, -1),
]


def rgba_to_p(im: Image.Image) -> Image.Image:
    alpha = im.getchannel("A")
    mask = alpha.point(lambda v: 255 if v >= 40 else 0)
    rgb = Image.new("RGB", im.size, (0, 0, 0))
    rgb.paste(im.convert("RGB"), mask=mask)
    p = rgb.convert("P", palette=Image.Palette.ADAPTIVE, colors=255)
    pal = (p.getpalette() or [])[:765] + [0, 0, 0]
    pix = bytearray(p.tobytes())
    for i, mv in enumerate(mask.getdata()):
        if mv == 0:
            pix[i] = 255
    out = Image.frombytes("P", p.size, bytes(pix))
    out.putpalette(pal)
    return out


def save_gif(path: Path, frames: list[Image.Image], durations: list[int]) -> None:
    ps = [rgba_to_p(fr.convert("RGBA")) for fr in frames]
    ps[0].save(
        path,
        save_all=True,
        append_images=ps[1:],
        duration=durations,
        loop=0,
        disposal=2,
        transparency=255,
    )


def column_ink(im: Image.Image, thresh: int = 40) -> list[int]:
    w, h = im.size
    px = im.load()
    counts = []
    for x in range(w):
        n = 0
        for y in range(h):
            if px[x, y][3] > thresh:
                n += 1
        counts.append(n)
    return counts


def letter_bands(im: Image.Image, n: int = 6) -> list[tuple[int, int]]:
    """Cut only at the thin empty (or near-empty) columns between letters."""
    inks = column_ink(im)
    w = len(inks)
    content = [x for x, v in enumerate(inks) if v > 0]
    if not content:
        raise RuntimeError("logo has no ink")
    left, right = content[0], content[-1]

    # Valleys: local minima in the gutters. Crayon letters can leave 0–8 ink
    # pixels in the gap; never treat a fat stroke as a split.
    raw: list[int] = []
    for x in range(left + 8, right - 8):
        v = inks[x]
        if v > 8:
            continue
        if v <= inks[x - 1] and v <= inks[x + 1] and (inks[x - 1] > v or inks[x + 1] > v):
            raw.append(x)

    # Cluster neighboring valley columns; keep the emptiest x in each cluster.
    clusters: list[list[int]] = []
    for x in raw:
        if clusters and x - clusters[-1][-1] <= 4:
            clusters[-1].append(x)
        else:
            clusters.append([x])
    splits = [min(c, key=lambda x: (inks[x], x)) for c in clusters]

    # Need exactly n-1 gutters. If extras, drop the least empty / tightest.
    need = n - 1
    if len(splits) > need:
        splits = sorted(splits, key=lambda x: (inks[x], -min(x - left, right - x)))[:need]
        splits.sort()
    if len(splits) != need:
        raise RuntimeError(f"expected {need} letter gutters, found {splits} inks={[(x, inks[x]) for x in splits]}")

    bands: list[tuple[int, int]] = []
    start = left
    for cut in splits:
        bands.append((start, cut - 1))
        start = cut + 1
    bands.append((start, right))
    if any(b[1] < b[0] for b in bands):
        raise RuntimeError(f"empty letter band in {bands}")
    return bands


def make_logo() -> None:
    src = Image.open(IMG / "logo.gif")
    src.seek(0)
    base = src.convert("RGBA")
    w, h = base.size
    bands = letter_bands(base, 6)
    frame2 = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    debug = ROOT / "public" / "img" / "_letter-debug"
    # keep debug next to script output only if asked; print widths instead
    widths = []
    for i, (x0, x1) in enumerate(bands):
        dx, dy = JITTER[i]
        strip = base.crop((x0, 0, x1 + 1, h))
        frame2.paste(strip, (max(0, x0 + dx), dy), strip)
        widths.append((i, x0, x1, x1 - x0 + 1, dx, dy))
    save_gif(IMG / "logo.gif", [base, frame2], [200, 200])
    print("logo.gif bands", widths)


def rects(cells: list[tuple]) -> Image.Image:
    im = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    px = im.load()
    for cell in cells:
        x, y, ww, hh, color = cell[:5]
        r, g, b = color
        for yy in range(y, y + hh):
            for xx in range(x, x + ww):
                if 0 <= xx < 32 and 0 <= yy < 32:
                    px[xx, yy] = (r, g, b, 255)
    return im


def hex_rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def face_cells(wash: str, hair: str, blush: str, extra: list, closed: bool) -> list[tuple]:
    ink = hex_rgb("#1A1020")
    w = hex_rgb(wash)
    hr = hex_rgb(hair)
    bl = hex_rgb(blush)
    white = hex_rgb("#FFF6E8")
    cells = [
        (10, 6, 12, 1, ink),
        (9, 7, 1, 3, ink),
        (22, 7, 1, 3, ink),
        (10, 7, 12, 3, hr),
        (8, 10, 1, 12, ink),
        (23, 10, 1, 12, ink),
        (9, 10, 14, 12, w),
        (9, 13, 3, 2, w),
        (20, 13, 3, 2, w),
        (13, 18, 1, 1, ink),
        (18, 18, 1, 1, ink),
        (14, 19, 4, 1, ink),
        (11, 21, 2, 1, bl),
        (19, 21, 2, 1, bl),
        (9, 22, 1, 1, ink),
        (22, 22, 1, 1, ink),
        (10, 22, 12, 2, w),
        (10, 24, 1, 1, ink),
        (21, 24, 1, 1, ink),
        (11, 24, 10, 1, w),
        (11, 25, 10, 1, ink),
    ]
    if closed:
        cells += [(12, 14, 2, 1, ink), (18, 14, 2, 1, ink)]
    else:
        cells += [
            (12, 13, 2, 2, white),
            (18, 13, 2, 2, white),
            (12, 14, 1, 1, ink),
            (19, 14, 1, 1, ink),
        ]
    for item in extra:
        x, y, ww, hh, c = item
        cells.append((x, y, ww, hh, hex_rgb(c)))
    return cells


FACES = [
    {"wash": "#FF8FB3", "hair": "#4A1F7A", "blush": "#F09090", "extra": [(10, 5, 12, 2, "#4A1F7A"), (14, 4, 4, 1, "#4A1F7A")]},
    {"wash": "#8CFF2E", "hair": "#2A6B12", "blush": "#C8F090", "extra": [(11, 16, 10, 1, "#2A6B12")]},
    {"wash": "#FFE566", "hair": "#C48A00", "blush": "#FFB4A0", "extra": [(9, 8, 3, 2, "#C48A00"), (20, 8, 3, 2, "#C48A00")]},
    {"wash": "#56B2FD", "hair": "#0B3A82", "blush": "#F09090", "extra": [(11, 12, 10, 1, "#1A1020"), (11, 12, 1, 3, "#1A1020"), (20, 12, 1, 3, "#1A1020")]},
    {"wash": "#FF9F43", "hair": "#7A3B00", "blush": "#FFB4A0", "extra": [(8, 9, 16, 2, "#7A3B00"), (12, 6, 8, 3, "#7A3B00")]},
    {"wash": "#C084FC", "hair": "#5B21B6", "blush": "#F09090", "extra": [(13, 17, 6, 1, "#FFF6E8")]},
    {"wash": "#4ADE80", "hair": "#14532D", "blush": "#C8F090", "extra": [(10, 6, 12, 2, "#14532D"), (15, 4, 2, 2, "#14532D")]},
    {"wash": "#FF6B6B", "hair": "#7F1D1D", "blush": "#FFB4A0", "extra": []},
    {"wash": "#67E8F9", "hair": "#155E75", "blush": "#F09090", "extra": [(14, 10, 4, 2, "#155E75")]},
    {"wash": "#F5E6C8", "hair": "#44403C", "blush": "#F09090", "extra": [(9, 7, 14, 3, "#44403C"), (10, 6, 12, 1, "#44403C")]},
    {"wash": "#D4A574", "hair": "#431407", "blush": "#E8A090", "extra": [(8, 11, 2, 6, "#431407"), (22, 11, 2, 6, "#431407")]},
    {"wash": "#FFF7ED", "hair": "#1E293B", "blush": "#FECACA", "extra": [(10, 5, 12, 3, "#1E293B"), (13, 4, 6, 1, "#334155")]},
]


def make_faces() -> None:
    AV.mkdir(parents=True, exist_ok=True)
    IMG.mkdir(parents=True, exist_ok=True)
    for i, spec in enumerate(FACES):
        open_f = rects(face_cells(closed=False, **spec))
        shut_f = rects(face_cells(closed=True, **spec))
        path = AV / f"ink-{i}.gif"
        save_gif(path, [open_f, shut_f], [700, 140])
        save_gif(IMG / f"ink-{i}.gif", [open_f, shut_f], [700, 140])
    print("wrote 12 blink gifs")


if __name__ == "__main__":
    make_logo()
    make_faces()
