"""Rebuild the Wicked Music icon set from app-icon-src/logo-source.png.

The source art is a note glyph sitting on a dark rounded plate. The plate and the
backdrop are cut away so the glyph ships with a transparent background and reads
on any taskbar, dock or window shade.

Usage: python app-icon-src/build_icons.py
"""

from __future__ import annotations

import io
import struct
from collections import Counter
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "app-icon-src" / "logo-source.png"
ICONS = ROOT / "src-tauri" / "icons"
PUBLIC = ROOT / "public"

MASTER = 1024
# Luminance ramp used to separate the glyph from the plate: everything at or
# below LO is plate, at or above HI is glyph, in between fades for soft edges.
ALPHA_LO = 46
ALPHA_HI = 100
# Fraction of the canvas the glyph fills after it is re-centred.
GLYPH_SCALE = 0.9
# iOS rejects icons with alpha, so those sizes are flattened onto this shade.
IOS_BACKDROP = (24, 24, 32)


def plate_color(im: Image.Image) -> tuple[int, int, int]:
    """Most common dark shade in the art, i.e. the rounded plate behind the glyph."""
    counts: Counter[tuple[int, int, int]] = Counter()
    for count, color in im.convert("RGB").getcolors(im.width * im.height) or []:
        if 25 <= sum(color) <= 110:
            counts[color] += count
    return counts.most_common(1)[0][0] if counts else (28, 28, 38)


def cut_out_glyph(im: Image.Image) -> Image.Image:
    """Turn the plate into transparency and undo the plate tint on soft edges."""
    backdrop = plate_color(im)
    out = Image.new("RGBA", im.size)
    src = im.load()
    dst = out.load()
    span = ALPHA_HI - ALPHA_LO

    for y in range(im.height):
        for x in range(im.width):
            r, g, b, _ = src[x, y]
            lum = (299 * r + 587 * g + 114 * b) // 1000
            if lum <= ALPHA_LO:
                continue
            if lum >= ALPHA_HI:
                dst[x, y] = (r, g, b, 255)
                continue

            alpha = round(255 * (lum - ALPHA_LO) / span)
            # Edge pixels are the glyph blended over the plate; recover the glyph
            # colour so the cut-out has no dark fringe on light backgrounds.
            unmixed = []
            for channel, back in zip((r, g, b), backdrop):
                value = (channel * 255 - back * (255 - alpha)) // max(alpha, 1)
                unmixed.append(min(255, max(0, value)))
            dst[x, y] = (*unmixed, alpha)

    return out


def reframe(im: Image.Image) -> Image.Image:
    """Centre the glyph on a square canvas so it fills GLYPH_SCALE of the icon."""
    box = im.getchannel("A").point(lambda v: 255 if v > 12 else 0).getbbox()
    glyph = im.crop(box) if box else im

    target = round(MASTER * GLYPH_SCALE)
    ratio = min(target / glyph.width, target / glyph.height)
    size = (max(1, round(glyph.width * ratio)), max(1, round(glyph.height * ratio)))
    glyph = glyph.resize(size, Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (MASTER, MASTER), (0, 0, 0, 0))
    canvas.paste(glyph, ((MASTER - size[0]) // 2, (MASTER - size[1]) // 2))
    return canvas


def scaled(master: Image.Image, size: int) -> Image.Image:
    return master.resize((size, size), Image.Resampling.LANCZOS)


def png_bytes(im: Image.Image) -> bytes:
    buf = io.BytesIO()
    im.save(buf, format="PNG")
    return buf.getvalue()


def write_png(path: Path, master: Image.Image, size: int, opaque: bool = False) -> None:
    frame = scaled(master, size)
    if opaque:
        flat = Image.new("RGB", frame.size, IOS_BACKDROP)
        flat.paste(frame, mask=frame.getchannel("A"))
        frame = flat
    path.parent.mkdir(parents=True, exist_ok=True)
    frame.save(path)


def write_ico(path: Path, master: Image.Image, sizes: list[int]) -> None:
    # 32 first: Windows picks the leading entry for the window/taskbar icon.
    order = [32] + [s for s in sizes if s != 32]
    frames = [(s, png_bytes(scaled(master, s))) for s in order]

    offset = 6 + 16 * len(frames)
    entries = b""
    blobs = b""
    for size, data in frames:
        dim = 0 if size >= 256 else size
        entries += struct.pack("<BBBBHHII", dim, dim, 0, 0, 1, 32, len(data), offset)
        offset += len(data)
        blobs += data

    path.write_bytes(struct.pack("<HHH", 0, 1, len(frames)) + entries + blobs)


def write_icns(path: Path, master: Image.Image) -> None:
    types = {
        b"ic11": 32,
        b"ic12": 64,
        b"ic07": 128,
        b"ic13": 256,
        b"ic08": 256,
        b"ic14": 512,
        b"ic09": 512,
        b"ic10": 1024,
    }
    body = b""
    for kind, size in types.items():
        data = png_bytes(scaled(master, size))
        body += kind + struct.pack(">I", len(data) + 8) + data
    path.write_bytes(b"icns" + struct.pack(">I", len(body) + 8) + body)


def main() -> None:
    source = Image.open(SRC).convert("RGBA")
    if source.size != (MASTER, MASTER):
        source = source.resize((MASTER, MASTER), Image.Resampling.LANCZOS)

    master = reframe(cut_out_glyph(source))
    master.save(ROOT / "app-icon-src" / "icon-1024.png")

    for name, size in {
        "32x32.png": 32,
        "64x64.png": 64,
        "128x128.png": 128,
        "128x128@2x.png": 256,
        "icon.png": 512,
    }.items():
        write_png(ICONS / name, master, size)

    for size in (30, 44, 71, 89, 107, 142, 150, 284, 310):
        write_png(ICONS / f"Square{size}x{size}Logo.png", master, size)
    write_png(ICONS / "StoreLogo.png", master, 50)

    write_ico(ICONS / "icon.ico", master, [16, 24, 32, 48, 64, 128, 256])
    write_icns(ICONS / "icon.icns", master)

    for bucket, launcher, foreground in (
        ("mdpi", 48, 108),
        ("hdpi", 49, 162),
        ("xhdpi", 96, 216),
        ("xxhdpi", 144, 324),
        ("xxxhdpi", 192, 432),
    ):
        folder = ICONS / "android" / f"mipmap-{bucket}"
        write_png(folder / "ic_launcher.png", master, launcher)
        write_png(folder / "ic_launcher_round.png", master, launcher)
        write_png(folder / "ic_launcher_foreground.png", master, foreground)

    for name, size in {
        "AppIcon-20x20@1x.png": 20,
        "AppIcon-20x20@2x.png": 40,
        "AppIcon-20x20@2x-1.png": 40,
        "AppIcon-20x20@3x.png": 60,
        "AppIcon-29x29@1x.png": 29,
        "AppIcon-29x29@2x.png": 58,
        "AppIcon-29x29@2x-1.png": 58,
        "AppIcon-29x29@3x.png": 87,
        "AppIcon-40x40@1x.png": 40,
        "AppIcon-40x40@2x.png": 80,
        "AppIcon-40x40@2x-1.png": 80,
        "AppIcon-40x40@3x.png": 120,
        "AppIcon-60x60@2x.png": 120,
        "AppIcon-60x60@3x.png": 180,
        "AppIcon-76x76@1x.png": 76,
        "AppIcon-76x76@2x.png": 152,
        "AppIcon-83.5x83.5@2x.png": 167,
        "AppIcon-512@2x.png": 1024,
    }.items():
        write_png(ICONS / "ios" / name, master, size, opaque=True)

    # Shared with the UI: window favicon and the in-app brand mark.
    write_png(PUBLIC / "logo.png", master, 512)

    print(f"Rebuilt icons from {SRC.name}")


if __name__ == "__main__":
    main()
