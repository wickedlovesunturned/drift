#!/usr/bin/env python3
"""Generate the Windows (NSIS) installer artwork for drift.

Outputs into src-tauri/installer/:
  header.bmp    150x57   MUI header strip (shown on inner pages)
  sidebar.bmp   164x314  MUI welcome/finish page sidebar
  installer.ico          multi-size icon used for setup.exe and uninstaller

BMPs are written as 24-bit BMP3 with no alpha, which is what NSIS MUI2 expects.
Run with:  python app-icon-src/build_installer_assets.py
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SRC_ICON = ROOT / "app-icon-src" / "icon-1024.png"
OUT_DIR = ROOT / "src-tauri" / "installer"
FONT_PATH = ROOT / "public" / "fonts" / "PlusJakartaSans.ttf"

# Brand tokens lifted straight from src/styles.css
BG = (5, 5, 9)
BG_ELEVATED = (20, 20, 29)
ACCENT = (153, 152, 204)
ACCENT_STRONG = (43, 42, 94)
TEXT = (242, 242, 247)
MUTED = (162, 161, 176)

SUPERSAMPLE = 4


def load_font(size: int, weight: int = 600) -> ImageFont.FreeTypeFont:
    font = ImageFont.truetype(str(FONT_PATH), size)
    try:  # Plus Jakarta Sans ships as a variable font.
        font.set_variation_by_axes([weight])
    except (AttributeError, OSError):
        pass
    return font


def glyph(size: int) -> Image.Image:
    """The drift note, trimmed of its transparent padding and resized."""
    art = Image.open(SRC_ICON).convert("RGBA")
    bbox = art.getbbox()
    if bbox:
        art = art.crop(bbox)
    return art.resize((size, size), Image.LANCZOS)


def vertical_wash(size: tuple[int, int], top: tuple[int, int, int],
                  bottom: tuple[int, int, int]) -> Image.Image:
    w, h = size
    grad = Image.new("RGB", (1, h))
    px = grad.load()
    for y in range(h):
        t = y / max(h - 1, 1)
        px[0, y] = tuple(round(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
    return grad.resize((w, h), Image.BICUBIC)


def accent_bloom(base: Image.Image, center: tuple[int, int], radius: int,
                 strength: float) -> Image.Image:
    """Soft radial accent glow, composited additively onto the background."""
    w, h = base.size
    ss = 2
    glow = Image.new("L", (w * ss, h * ss), 0)
    d = ImageDraw.Draw(glow)
    cx, cy, r = center[0] * ss, center[1] * ss, radius * ss
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=255)
    glow = glow.filter(ImageFilter.GaussianBlur(r * 0.45))
    glow = glow.resize((w, h), Image.LANCZOS).point(lambda v: int(v * strength))
    tint = Image.new("RGB", (w, h), ACCENT_STRONG)
    return Image.composite(Image.blend(base, tint, 0.85), base, glow)


def build_sidebar() -> None:
    w, h = 164, 314
    img = vertical_wash((w, h), BG_ELEVATED, BG)
    img = accent_bloom(img, center=(w // 2, 112), radius=100, strength=0.9)
    img = accent_bloom(img, center=(w + 20, h - 24), radius=84, strength=0.5)

    note = glyph(78)
    img.paste(note, ((w - 78) // 2, 78), note)

    d = ImageDraw.Draw(img)
    title = load_font(30, 700)
    tagline = load_font(11, 500)

    d.text((w // 2, 186), "drift", font=title, fill=TEXT, anchor="mm")

    for i, line in enumerate(("a desktop client", "for Navidrome")):
        d.text((w // 2, 214 + i * 15), line, font=tagline, fill=MUTED, anchor="mm")

    # Short accent rule, kept subtle so it reads as a hairline not a divider.
    d.rectangle((w // 2 - 16, 252, w // 2 + 16, 252), fill=ACCENT)

    img.save(OUT_DIR / "sidebar.bmp", "BMP")


def build_header() -> None:
    w, h = 150, 57
    ss = SUPERSAMPLE
    img = vertical_wash((w * ss, h * ss), BG_ELEVATED, BG)
    img = accent_bloom(img, center=(int(w * ss * 0.12), h * ss // 2),
                       radius=int(h * ss * 0.85), strength=0.75)

    note = glyph(34 * ss)
    img.paste(note, (12 * ss, (h * ss - 34 * ss) // 2), note)

    d = ImageDraw.Draw(img)
    d.text((54 * ss, h * ss // 2), "drift", font=load_font(21 * ss, 700),
           fill=TEXT, anchor="lm")
    d.rectangle((0, h * ss - ss, w * ss, h * ss), fill=ACCENT_STRONG)

    img.resize((w, h), Image.LANCZOS).save(OUT_DIR / "header.bmp", "BMP")


def build_icon() -> None:
    art = Image.open(SRC_ICON).convert("RGBA")
    sizes = [(s, s) for s in (16, 24, 32, 48, 64, 128, 256)]
    art.save(OUT_DIR / "installer.ico", format="ICO", sizes=sizes)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    build_sidebar()
    build_header()
    build_icon()
    for name in ("sidebar.bmp", "header.bmp", "installer.ico"):
        print(f"wrote {(OUT_DIR / name).relative_to(ROOT)}")


if __name__ == "__main__":
    main()
