#!/usr/bin/env python3
"""Key black, crop, and pack crayon faces/arrows into GIFs/PNGs."""

from pathlib import Path

from PIL import Image

SESS = Path("/Users/saksham/.grok/sessions/%2FUsers%2Fsaksham/01a0123b-6658-7f91-bda2-9615a24ec394/images")
ROOT = Path(__file__).resolve().parents[1]
AV = ROOT / "public" / "avatars"
IMG = ROOT / "public" / "img"

# open, closed
PAIRS = [
    ("12.jpg", "20.jpg"),
    ("7.jpg", "19.jpg"),
    ("6.jpg", "18.jpg"),
    ("4.jpg", "21.jpg"),
    ("8.jpg", "22.jpg"),
    ("15.jpg", "28.jpg"),
    ("17.jpg", "29.jpg"),
    ("10.jpg", "25.jpg"),
    ("11.jpg", "23.jpg"),
    ("13.jpg", "24.jpg"),
    ("14.jpg", "27.jpg"),
    ("16.jpg", "26.jpg"),
]


def key_and_crop(path: Path, size: int = 256) -> Image.Image:
    im = Image.open(path).convert("RGBA")
    px = im.load()
    w, h = im.size
    keep = []
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            lum = (r + g + b) / 3
            sat = max(r, g, b) - min(r, g, b)
            if lum < 28 or (lum < 48 and sat < 18):
                px[x, y] = (0, 0, 0, 0)
            else:
                keep.append((x, y))
    if not keep:
        raise RuntimeError(f"no ink in {path}")
    xs = [p[0] for p in keep]
    ys = [p[1] for p in keep]
    pad = 12
    box = (
        max(0, min(xs) - pad),
        max(0, min(ys) - pad),
        min(w, max(xs) + pad + 1),
        min(h, max(ys) + pad + 1),
    )
    crop = im.crop(box)
    # square pad
    side = max(crop.size)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(crop, ((side - crop.size[0]) // 2, (side - crop.size[1]) // 2), crop)
    return canvas.resize((size, size), Image.Resampling.LANCZOS)


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


def main() -> None:
    AV.mkdir(exist_ok=True)
    IMG.mkdir(exist_ok=True)
    for i, (open_n, shut_n) in enumerate(PAIRS):
        open_f = key_and_crop(SESS / open_n)
        shut_f = key_and_crop(SESS / shut_n)
        save_gif(AV / f"ink-{i}.gif", [open_f, shut_f], [700, 160])
        save_gif(IMG / f"ink-{i}.gif", [open_f, shut_f], [700, 160])
        print("face", i)
    for name, src in (("arrow-up.png", "5.jpg"), ("arrow-down.png", "3.jpg"), ("shuffle.png", "9.jpg")):
        icon = key_and_crop(SESS / src, 128)
        icon.save(IMG / name)
        print("icon", name)


if __name__ == "__main__":
    main()
