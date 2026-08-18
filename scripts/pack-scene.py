#!/usr/bin/env python3
from pathlib import Path

from PIL import Image

SESS = Path("/Users/saksham/.grok/sessions/%2FUsers%2Fsaksham/01a0123b-6658-7f91-bda2-9615a24ec394/images")
ROOT = Path(__file__).resolve().parents[1]
AV = ROOT / "public" / "avatars"
IMG = ROOT / "public" / "img"
NAVY = (18, 77, 165, 255)


def key_and_crop(path: Path, size: int | None = None, pad: int = 6) -> Image.Image:
    im = Image.open(path).convert("RGBA")
    px = im.load()
    w, h = im.size
    keep = []
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            lum = (r + g + b) / 3
            sat = max(r, g, b) - min(r, g, b)
            if lum < 30 or (lum < 52 and sat < 16):
                px[x, y] = (0, 0, 0, 0)
            else:
                keep.append((x, y))
    if not keep:
        raise RuntimeError(path)
    xs = [p[0] for p in keep]
    ys = [p[1] for p in keep]
    box = (max(0, min(xs) - pad), max(0, min(ys) - pad), min(w, max(xs) + pad + 1), min(h, max(ys) + pad + 1))
    crop = im.crop(box)
    side = max(crop.size)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(crop, ((side - crop.size[0]) // 2, (side - crop.size[1]) // 2), crop)
    if size:
        canvas = canvas.resize((size, size), Image.Resampling.LANCZOS)
    return canvas


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
    ps[0].save(path, save_all=True, append_images=ps[1:], duration=durations, loop=0, disposal=2, transparency=255)


def beanie() -> None:
    open_f = key_and_crop(SESS / "37.jpg", 256, pad=2)
    shut_f = key_and_crop(SESS / "42.jpg", 256, pad=2)
    save_gif(AV / "ink-4.gif", [open_f, shut_f], [700, 160])
    save_gif(IMG / "ink-4.gif", [open_f, shut_f], [700, 160])
    print("beanie ok")


def recolor_navy(im: Image.Image) -> Image.Image:
    from collections import Counter

    out = im.convert("RGBA")
    rgb = out.convert("RGB")
    bg = Counter(rgb.getdata()).most_common(1)[0][0]
    px = out.load()
    w, h = out.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            dist = ((r - bg[0]) ** 2 + (g - bg[1]) ** 2 + (b - bg[2]) ** 2) ** 0.5
            if dist < 42:
                px[x, y] = NAVY
    return out


def to_navy_gif_frame(im: Image.Image) -> Image.Image:
    rgb = im.convert("RGB")
    w, h = rgb.size
    px = rgb.load()
    is_navy = []
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            dist = ((r - NAVY[0]) ** 2 + (g - NAVY[1]) ** 2 + (b - NAVY[2]) ** 2) ** 0.5
            is_navy.append(dist < 28)
    doodles = rgb.copy()
    dp = doodles.load()
    i = 0
    for y in range(h):
        for x in range(w):
            if is_navy[i]:
                dp[x, y] = (255, 0, 255)
            i += 1
    q = doodles.convert("P", palette=Image.Palette.ADAPTIVE, colors=254)
    pal = bytearray((q.getpalette() or [])[:762])
    while len(pal) < 762:
        pal.extend((0, 0, 0))
    pal.extend((NAVY[0], NAVY[1], NAVY[2]))
    pix = bytearray(q.tobytes())
    for i, flag in enumerate(is_navy):
        if flag:
            pix[i] = 254
    out = Image.frombytes("P", (w, h), bytes(pix))
    out.putpalette(bytes(pal) + bytes(3))
    return out


def thin_doodles(im: Image.Image, keep: float = 0.7) -> Image.Image:
    out = im.convert("RGBA")
    w, h = out.size
    px = out.load()

    def is_ink(x: int, y: int) -> bool:
        r, g, b, _a = px[x, y]
        return ((r - NAVY[0]) ** 2 + (g - NAVY[1]) ** 2 + (b - NAVY[2]) ** 2) ** 0.5 >= 28

    seen = [[False] * w for _ in range(h)]
    blobs: list[list[tuple[int, int]]] = []
    for y in range(h):
        for x in range(w):
            if seen[y][x] or not is_ink(x, y):
                continue
            stack = [(x, y)]
            seen[y][x] = True
            cells: list[tuple[int, int]] = []
            while stack:
                cx, cy = stack.pop()
                cells.append((cx, cy))
                for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and is_ink(nx, ny):
                        seen[ny][nx] = True
                        stack.append((nx, ny))
            if len(cells) >= 40:
                blobs.append(cells)

    blobs.sort(key=lambda c: (sum(p[1] for p in c) / len(c), sum(p[0] for p in c) / len(c)))
    drop_n = int(round(len(blobs) * (1 - keep)))
    if drop_n:
        step = len(blobs) / drop_n
        drop = {min(len(blobs) - 1, int(i * step)) for i in range(drop_n)}
        for i, cells in enumerate(blobs):
            if i not in drop:
                continue
            for x, y in cells:
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < w and 0 <= ny < h:
                            px[nx, ny] = NAVY
    print("thin", len(blobs), "->", len(blobs) - drop_n)
    return out


def tile() -> None:
    # Whole figures only — stay inside the tile so repeats never slice a body.
    sprites = [
        key_and_crop(SESS / "38.jpg", 100),
        key_and_crop(SESS / "36.jpg", 98),
        key_and_crop(SESS / "39.jpg", 102),
        key_and_crop(SESS / "40.jpg", 100),
    ]
    # (sprite index, x, y, frame-2 nudge) — 16px gutter from every edge
    layout = [
        (0, 24, 26, (1, 0)),
        (3, 230, 22, (0, 1)),
        (1, 424, 30, (-1, 0)),
        (2, 118, 168, (0, -1)),
        (0, 336, 158, (1, 0)),
        (3, 36, 308, (0, 1)),
        (1, 246, 298, (-1, 0)),
        (2, 430, 286, (0, -1)),
        (0, 148, 436, (1, 0)),
        (3, 352, 428, (0, 1)),
        (2, 24, 448, (-1, 0)),
    ]
    size = 580
    f0 = Image.new("RGBA", (size, size), NAVY)
    f1 = Image.new("RGBA", (size, size), NAVY)
    for idx, x, y, (dx, dy) in layout:
        spr = sprites[idx]
        assert x >= 16 and y >= 16
        assert x + spr.size[0] <= size - 16
        assert y + spr.size[1] <= size - 16
        f0.paste(spr, (x, y), spr)
        f1.paste(spr, (x + dx, y + dy), spr)
    q0 = to_navy_gif_frame(f0)
    q1 = to_navy_gif_frame(f1)
    out = IMG / "tile.gif"
    q0.save(out, save_all=True, append_images=[q1], duration=300, loop=0, disposal=2)
    print("tile.gif", out.stat().st_size, Image.open(out).n_frames, "sprites", len(layout))


if __name__ == "__main__":
    beanie()
    tile()
