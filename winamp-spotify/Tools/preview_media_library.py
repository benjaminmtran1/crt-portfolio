#!/usr/bin/env python3
"""Renders the media library window for three very different skins.

Mirrors SkinThemeDerivation + ThemedChrome + MediaLibraryView in Python so the
result can be seen without a Mac. The point is the third skin: a deliberately
hostile palette -- hot pink faceplate, near-black text on a near-black list, a
selection the same colour as the background -- which is what a random download
can look like. If the contrast logic works, that window is still readable.

One honest difference from the app: row text here is drawn with the 5x6 bitmap
font, because a system font cannot be rendered in pure Python. In the app, tabs
and buttons use the bitmap font exactly as shown, and content rows use the font
named in the skin's pledit.txt (or the system font), mixed-case.

    python3 Tools/preview_media_library.py docs/media-library-preview.png
"""

import importlib.util, os, struct, sys, zlib

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

spec = importlib.util.spec_from_file_location(
    "preview", os.path.join(HERE, "preview_default_skin.py")
)
preview = importlib.util.module_from_spec(spec)
spec.loader.exec_module(preview)

Canvas = preview.Canvas
from font_art import GLYPHS  # noqa: E402

W, H = 420, 320

# --- Skins to test ----------------------------------------------------------
# Each entry is the palette that main.bmp gets drawn with, plus the pledit.txt
# and viscolor.txt values a skin would ship.

SKINS = [
    {
        "name": "NIGHTSHADE (BUILT IN)",
        "face": {
            "FACE_HIGH": (86, 92, 99), "FACE_MID": (54, 58, 64),
            "FACE_LOW": (34, 37, 41), "FACE_SHADOW": (18, 19, 21),
            "BEVEL_LIGHT": (122, 130, 139), "BEVEL_DARK": (14, 15, 17),
            "LCD_BG": (8, 14, 11), "LCD_BRIGHT": (66, 255, 122),
            "LCD_DIM": (22, 86, 44), "TITLE_A_TOP": (74, 82, 90),
            "TITLE_A_BOT": (38, 42, 47), "ACCENT": (0, 214, 96),
        },
        "pledit": {
            "normal": (66, 255, 122), "current": (255, 255, 255),
            "background": (8, 14, 11), "selected": (26, 62, 44),
            "font": None, "declares_mb": False,
            "mb_text": (0, 255, 0), "mb_background": (0, 0, 0),
        },
        "vis_background": (8, 14, 11),
        "vis_spectrum_brightest": (66, 255, 122),
    },
    {
        "name": "AMBER CRT",
        "face": {
            "FACE_HIGH": (92, 80, 66), "FACE_MID": (58, 50, 41),
            "FACE_LOW": (38, 32, 26), "FACE_SHADOW": (20, 17, 14),
            "BEVEL_LIGHT": (134, 118, 96), "BEVEL_DARK": (16, 13, 11),
            "LCD_BG": (16, 10, 4), "LCD_BRIGHT": (255, 178, 52),
            "LCD_DIM": (108, 68, 16), "TITLE_A_TOP": (86, 74, 60),
            "TITLE_A_BOT": (44, 37, 30), "ACCENT": (255, 140, 0),
        },
        "pledit": {
            "normal": (255, 178, 52), "current": (255, 255, 255),
            "background": (16, 10, 4), "selected": (84, 52, 12),
            "font": None, "declares_mb": False,
            "mb_text": (0, 255, 0), "mb_background": (0, 0, 0),
        },
        "vis_background": (16, 10, 4),
        "vis_spectrum_brightest": (255, 224, 150),
    },
    {
        "name": "HOSTILE DOWNLOAD",
        # The adversarial case. Nothing here was chosen with text in mind.
        "face": {
            "FACE_HIGH": (255, 90, 220), "FACE_MID": (236, 0, 200),
            "FACE_LOW": (190, 0, 160), "FACE_SHADOW": (120, 0, 100),
            "BEVEL_LIGHT": (255, 170, 240), "BEVEL_DARK": (70, 0, 60),
            "LCD_BG": (6, 6, 6), "LCD_BRIGHT": (18, 18, 18),
            "LCD_DIM": (12, 12, 12), "TITLE_A_TOP": (255, 60, 210),
            "TITLE_A_BOT": (180, 0, 150), "ACCENT": (255, 240, 0),
        },
        "pledit": {
            # Near-black text on near-black, and a selection that is the
            # background. All three are real things skins do.
            "normal": (8, 8, 8), "current": (10, 10, 10),
            "background": (6, 6, 6), "selected": (6, 6, 6),
            "font": None, "declares_mb": False,
            "mb_text": (0, 255, 0), "mb_background": (0, 0, 0),
        },
        "vis_background": (6, 6, 6),
        "vis_spectrum_brightest": (20, 20, 20),
    },
]

# --- Colour maths (mirrors SkinTheme) ---------------------------------------

def luminance(c):
    def channel(v):
        n = v / 255
        return n / 12.92 if n <= 0.03928 else ((n + 0.055) / 1.055) ** 2.4
    return 0.2126 * channel(c[0]) + 0.7152 * channel(c[1]) + 0.0722 * channel(c[2])

def contrast(a, b):
    la, lb = luminance(a), luminance(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)

def is_dark(c):
    return luminance(c) < 0.22

def mix(a, b, t):
    t = max(0.0, min(1.0, t))
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))

def lighten(c, amount): return mix(c, (255, 255, 255), amount)
def darken(c, amount): return mix(c, (0, 0, 0), amount)

def legible_over(color, surfaces, minimum=4.0):
    """Readable on every surface, not just the lightest -- panels are gradients.

    Tries both directions and keeps the better worst case: a luminance
    threshold sends saturated colours the wrong way.
    """
    def worst(candidate):
        return min(contrast(candidate, surface) for surface in surfaces)
    best, best_worst = color, worst(color)
    if best_worst >= minimum:
        return color
    for target in ((255, 255, 255), (0, 0, 0)):
        step = 0.1
        while step <= 1.0001:
            candidate = mix(color, target, step)
            ratio = worst(candidate)
            if ratio > best_worst:
                best, best_worst = candidate, ratio
            if ratio >= minimum:
                return candidate
            step += 0.1
    return best


def legible(color, background, minimum=4.0):
    return legible_over(color, [background], minimum)

# --- Derivation (mirrors SkinThemeDerivation) -------------------------------

CHROME_RECTS = [
    (4, 15, 267, 6), (4, 83, 267, 4), (4, 107, 267, 7),
    (1, 22, 8, 60), (267, 22, 7, 30),
]

def sample_chrome(main_bmp):
    out = []
    for x, y, w, h in CHROME_RECTS:
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                if 0 <= xx < main_bmp.w and 0 <= yy < main_bmp.h and main_bmp.alpha[yy][xx] > 128:
                    out.append(main_bmp.px[yy][xx])
    return out

def chrome_colors(samples):
    if not samples:
        raise SystemExit("no chrome samples")
    buckets = {}
    for c in samples:
        key = (c[0] >> 3, c[1] >> 3, c[2] >> 3)
        count, r, g, b = buckets.get(key, (0, 0, 0, 0))
        buckets[key] = (count + 1, r + c[0], g + c[1], b + c[2])
    count, r, g, b = max(buckets.values(), key=lambda e: e[0])
    base = (r // count, g // count, b // count)

    ordered = sorted(samples, key=luminance)
    def pct(f):
        return ordered[min(len(ordered) - 1, max(0, int((len(ordered) - 1) * f)))]
    bevel_dark, bevel_light = pct(0.04), pct(0.96)
    if contrast(bevel_light, bevel_dark) < 1.6:
        bevel_light, bevel_dark = lighten(base, 0.45), darken(base, 0.55)

    return {
        "faceBase": base,
        "faceHighlight": mix(base, bevel_light, 0.45),
        "faceShadow": mix(base, bevel_dark, 0.45),
        "bevelLight": bevel_light,
        "bevelDark": bevel_dark,
    }

def derive_theme(main_bmp, skin):
    pledit = skin["pledit"]
    theme = dict(chrome_colors(sample_chrome(main_bmp)))

    list_bg = pledit["mb_background"] if pledit["declares_mb"] else pledit["background"]
    list_text = pledit["mb_text"] if pledit["declares_mb"] else pledit["normal"]

    vis_well = skin["vis_background"]
    display_bg = vis_well if contrast(vis_well, theme["faceBase"]) > 1.3 else pledit["background"]
    brightest = skin["vis_spectrum_brightest"]
    accent = pledit["current"] if contrast(pledit["current"], theme["faceBase"]) > 1.6 else brightest

    theme.update({
        # Faceplate text is a separate pair: a colour legible on the dark well
        # can be invisible on a bright faceplate.
        "faceText": brightest,
        "faceTextDim": mix(brightest, theme["faceBase"], 0.4),
        "displayBackground": display_bg,
        "displayText": brightest,
        "displayDim": mix(brightest, display_bg, 0.55),
        "listBackground": list_bg,
        "listText": list_text,
        "listAlternate": mix(list_bg, (255, 255, 255) if is_dark(list_bg) else (0, 0, 0), 0.07),
        "selectionBackground": pledit["selected"],
        "selectionText": pledit["current"],
        "accent": accent,
        "accentText": (255, 255, 255) if is_dark(accent) else (0, 0, 0),
    })
    return contrast_check(theme)

def contrast_check(theme):
    t = dict(theme)
    t["displayText"] = legible(t["displayText"], t["displayBackground"])
    t["listText"] = legible(t["listText"], t["listBackground"])
    t["selectionText"] = legible(t["selectionText"], t["selectionBackground"])
    t["accentText"] = legible(t["accentText"], t["accent"])
    t["displayDim"] = legible(t["displayDim"], t["displayBackground"], 2.5)
    # highlight-to-base: the range panels are drawn over. Tabs and buttons
    # reach faceShadow and check their own labels against it.
    face_surfaces = [t["faceHighlight"], t["faceBase"]]
    t["faceText"] = legible_over(t["faceText"], face_surfaces)
    t["faceTextDim"] = legible_over(t["faceTextDim"], face_surfaces, 2.5)
    if contrast(t["selectionBackground"], t["listBackground"]) < 1.25:
        t["selectionBackground"] = (
            lighten(t["selectionBackground"], 0.35) if is_dark(t["listBackground"])
            else darken(t["selectionBackground"], 0.35)
        )
        t["selectionText"] = legible(t["selectionText"], t["selectionBackground"])
    return t

# --- Widgets (mirrors ThemedChrome) -----------------------------------------

def bevel(c, x, y, w, h, light, dark, raised=True):
    tl, br = (light, dark) if raised else (dark, light)
    for xx in range(x, x + w):
        c.set(xx, y, tl); c.set(xx, y + h - 1, br)
    for yy in range(y, y + h):
        c.set(x, yy, tl); c.set(x + w - 1, yy, br)

def panel(c, t, x, y, w, h, bevelled=True):
    c.vgrad(x, y, w, h, t["faceHighlight"], t["faceBase"])
    if bevelled:
        bevel(c, x, y, w, h, t["bevelLight"], t["bevelDark"], True)

def well(c, t, x, y, w, h, interior=None):
    c.fill(x, y, w, h, interior or t["displayBackground"])
    bevel(c, x, y, w, h, t["bevelLight"], t["bevelDark"], False)

def button(c, t, x, y, w, h, state="normal"):
    tops = {
        "normal": (t["faceHighlight"], t["faceBase"]),
        "pressed": (t["faceShadow"], darken(t["faceBase"], 0.2)),
        "disabled": (t["faceBase"], t["faceBase"]),
        "active": (t["accent"], darken(t["accent"], 0.25)),
    }
    top, bottom = tops[state]
    c.vgrad(x, y, w, h, top, bottom)
    bevel(c, x, y, w, h, t["bevelLight"], t["bevelDark"], state != "pressed")

def button_text_color(t, state):
    if state == "active":
        return t["accentText"]
    if state == "disabled":
        return mix(t["faceBase"], t["bevelDark"], 0.5)
    return legible(t["displayText"], t["faceBase"], 3.0)

def tab(c, t, x, y, w, h, selected):
    if selected:
        c.vgrad(x, y, w, h, t["faceHighlight"], t["faceBase"])
    else:
        c.vgrad(x, y, w, h, t["faceBase"], t["faceShadow"])
    for xx in range(x, x + w):
        c.set(xx, y, t["bevelLight"])
    for yy in range(y, y + h):
        c.set(x, yy, t["bevelLight"]); c.set(x + w - 1, yy, t["bevelDark"])
    if selected:
        for xx in range(x + 1, x + w - 1):
            c.set(xx, y + h - 1, t["accent"]); c.set(xx, y + h - 2, t["accent"])
    else:
        for xx in range(x, x + w):
            c.set(xx, y + h - 1, t["bevelDark"])

def tab_text_color(t, selected):
    return legible(t["displayText"], t["faceHighlight"] if selected else t["faceShadow"], 3.0)

def artwork_frame(c, t, x, y, size):
    c.fill(x, y, size, size, t["displayBackground"])
    offset = 0
    while offset < size * 2:
        for yy in range(size):
            xx = offset - yy
            if 0 <= xx < size:
                c.set(x + xx, y + yy, t["displayDim"])
        offset += 6
    bevel(c, x, y, size, size, t["bevelLight"], t["bevelDark"], False)

# --- Text -------------------------------------------------------------------

def text(c, s, x, y, color, pitch=5, max_width=None, align="left"):
    s = s.upper()
    if max_width is not None:
        limit = max_width // pitch
        if limit <= 0:
            return
        if len(s) > limit:
            s = s[: max(0, limit - 1)] + "…"
    width = len(s) * pitch
    if align == "right":
        x = x - width
    elif align == "center":
        x = x - width // 2
    for i, ch in enumerate(s):
        g = GLYPHS.get(ch) or GLYPHS.get(ch.upper()) or GLYPHS.get(" ")
        if g:
            c.stamp(g, x + i * pitch, y, color)

# --- Window frame (mirrors SkinnedFrame over pledit.bmp tiles) ---------------

TOP_H, BOTTOM_H, LEFT_W, RIGHT_W = 20, 38, 12, 20

def draw_frame(c, t, title):
    # Top rail.
    c.vgrad(0, 0, W, TOP_H, lighten(t["faceBase"], 0.25), t["faceBase"])
    bevel(c, 0, 0, W, TOP_H, t["bevelLight"], t["bevelDark"], True)
    plate_w = len(title) * 5 + 16
    plate_x = (W - plate_w) // 2
    panel(c, t, plate_x, 3, plate_w, 14)
    text(c, title, plate_x + 8, 7, t["faceText"])
    # Close / shade buttons.
    for bx in (W - 22, W - 12):
        button(c, t, bx, 3, 9, 9)
    # Side rails.
    for x, w in ((0, LEFT_W), (W - RIGHT_W, RIGHT_W)):
        c.fill(x, TOP_H, w, H - TOP_H - BOTTOM_H, t["faceBase"])
        bevel(c, x, TOP_H, w, H - TOP_H - BOTTOM_H, t["bevelLight"], t["bevelDark"], True)
    # Bottom panel.
    c.vgrad(0, H - BOTTOM_H, W, BOTTOM_H, t["faceBase"], t["faceShadow"])
    bevel(c, 0, H - BOTTOM_H, W, BOTTOM_H, t["bevelLight"], t["bevelDark"], True)

# --- Sample content ---------------------------------------------------------

TABS = ["SEARCH", "ARTISTS", "ALBUMS", "LISTS", "LIKED"]
ROWS = [
    ("Dummy", "Portishead", "1994", True),
    ("Third", "Portishead", "2008", True),
    ("Portishead", "Portishead", "1997", True),
    ("Roseland NYC Live", "Portishead", "1998", True),
    ("Glory Box", "Portishead", "5:06", False),
    ("Sour Times", "Portishead", "4:11", False),
    ("Wandering Star", "Portishead", "4:51", False),
    ("Numb", "Portishead", "3:54", False),
    ("It Could Be Sweet", "Portishead", "4:16", False),
    ("Strangers", "Portishead", "3:55", False),
]
SELECTED_ROW = 4

def render(skin):
    # Build this skin's main.bmp through the real drawing path, then sample it.
    for key, value in skin["face"].items():
        setattr(preview, key, value)
    main_bmp = preview.main_background()
    t = derive_theme(main_bmp, skin)

    c = Canvas(W, H)
    draw_frame(c, t, "MEDIA LIBRARY")

    content = (LEFT_W, TOP_H, W - LEFT_W - RIGHT_W, H - TOP_H - BOTTOM_H)
    cx, cy, cw, ch = content

    # Tabs.
    tab_w = cw // len(TABS)
    for i, label in enumerate(TABS):
        x = cx + i * tab_w
        w = (cx + cw - x) if i == len(TABS) - 1 else tab_w
        selected = i == 0
        tab(c, t, x, cy, w, 14, selected)
        text(c, label, x + w // 2, cy + 4, tab_text_color(t, selected), align="center")

    # Nav bar with the search well.
    nav_y = cy + 14
    panel(c, t, cx, nav_y, cw, 16, bevelled=False)
    well(c, t, cx, nav_y + 1, cw - 44, 14)
    text(c, "PORTISHEAD", cx + 4, nav_y + 5, t["displayText"], max_width=cw - 52)
    button(c, t, cx + cw - 42, nav_y + 1, 42, 14)
    text(c, "FIND", cx + cw - 21, nav_y + 5, button_text_color(t, "normal"), align="center")

    # Header strip with artwork.
    head_y = nav_y + 16
    panel(c, t, cx, head_y, cw, 46, bevelled=False)
    artwork_frame(c, t, cx + 4, head_y + 4, 38)
    # Faceplate colours: the header strip is a panel, and a colour legible
    # on the dark well can vanish here.
    text(c, "PORTISHEAD", cx + 48, head_y + 8, t["faceText"], max_width=cw - 56)
    text(c, "TRIP HOP · BRISTOL", cx + 48, head_y + 23, t["faceTextDim"], max_width=cw - 56)

    # List.
    list_y = head_y + 46
    list_h = cy + ch - list_y
    well(c, t, cx, list_y, cw, list_h, interior=t["listBackground"])

    row_h, thumb = 18, 14
    interior = (cx + 2, list_y + 2, cw - 4, list_h - 4)
    ix, iy, iw, _ = interior
    trailing_w, chevron_w = 46, 8
    available = max(20, iw - thumb - 6 - trailing_w - chevron_w - 6)
    title_w = int(available * 0.58)
    subtitle_w = available - title_w

    for i, (title, subtitle, trailing, drillable) in enumerate(ROWS):
        y = iy + i * row_h
        if y + row_h > iy + interior[3]:
            break
        selected = i == SELECTED_ROW
        if selected:
            c.fill(ix, y, iw, row_h, t["selectionBackground"])
        elif i % 2 == 1:
            c.fill(ix, y, iw, row_h, t["listAlternate"])

        title_color = t["selectionText"] if selected else t["listText"]
        dim = (mix(t["selectionText"], t["selectionBackground"], 0.35) if selected
               else mix(t["listText"], t["listBackground"], 0.45))

        x = ix + 2
        artwork_frame(c, t, x, y + (row_h - thumb) // 2, thumb)
        x += thumb + 4
        text(c, title, x, y + 6, title_color, max_width=title_w)
        x += title_w + 4
        text(c, subtitle, x, y + 6, dim, max_width=subtitle_w)
        x += subtitle_w + 4
        text(c, trailing, ix + iw - chevron_w - 2, y + 6, dim, align="right")
        if drillable:
            text(c, ">", ix + iw - 2, y + 6, dim, align="right")

    # Bottom buttons and status.
    by = H - BOTTOM_H + 5
    x = 8
    for label, w in (("PLAY", 38), ("ENQUEUE", 50), ("REPLACE", 50)):
        button(c, t, x, by, w, 14)
        text(c, label, x + w // 2, by + 4, button_text_color(t, "normal"),
             pitch=4 if len(label) * 5 > w - 4 else 5, align="center")
        x += w + 4
    # In a recessed well: drawing onto the skin's bottom-panel artwork means
    # an unknown background, and a sunken readout is the more Winamp thing.
    status_y = H - BOTTOM_H + 21
    well(c, t, 8, status_y, W - 16, 12)
    text(c, "10 ITEMS · 6 TRACKS · 26:13", 11, status_y + 3, t["displayDim"])

    # Contrast report, so the numbers are checkable and not just eyeballed.
    report = {
        "list": contrast(t["listText"], t["listBackground"]),
        "selection": contrast(t["selectionText"], t["selectionBackground"]),
        "display": contrast(t["displayText"], t["displayBackground"]),
        "accent": contrast(t["accentText"], t["accent"]),
        "face text": min(contrast(t["faceText"], s)
                         for s in (t["faceHighlight"], t["faceBase"])),
        "face dim": min(contrast(t["faceTextDim"], s)
                        for s in (t["faceHighlight"], t["faceBase"])),
        "status": contrast(t["displayDim"], t["displayBackground"]),
        "sel/list bg": contrast(t["selectionBackground"], t["listBackground"]),
    }
    return c, t, report

# --- Output -----------------------------------------------------------------

def write_png(canvas, path, scale=2):
    w, h = canvas.w * scale, canvas.h * scale
    raw = bytearray()
    for y in range(h):
        raw.append(0)
        src = canvas.px[y // scale]
        for x in range(w):
            raw += bytes(src[x // scale])
    def chunk(tag, data):
        return (struct.pack(">I", len(data)) + tag + data
                + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))
    png = (b"\x89PNG\r\n\x1a\n"
           + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
           + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
           + chunk(b"IEND", b""))
    open(path, "wb").write(png)


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "docs/media-library-preview.png"

    label_h = 12
    sheet = Canvas(W, (H + label_h) * len(SKINS), fill=(20, 20, 20))
    failures = []

    for index, skin in enumerate(SKINS):
        window, theme, report = render(skin)
        top = index * (H + label_h)
        text(sheet, skin["name"], 6, top + 3, (200, 200, 200))
        sheet.blit(window, 0, top + label_h)

        print(f"{skin['name']}:")
        print(f"  faceplate  {theme['faceBase']}  list bg {theme['listBackground']}")
        for name, ratio in report.items():
            floor = 1.25 if name == "sel/list bg" else (
                2.5 if name in ("face dim", "status") else 4.0)
            status = "ok " if ratio >= floor else "FAIL"
            print(f"  {status} {name:<12} {ratio:5.2f}  (min {floor})")
            if ratio < floor:
                failures.append(f"{skin['name']}: {name} = {ratio:.2f}")
        print()

    write_png(sheet, out)
    print(f"wrote {out}")
    if failures:
        print("CONTRAST FAILURES:")
        for failure in failures:
            print(" ", failure)
        raise SystemExit(1)
    print("all contrast floors met")
