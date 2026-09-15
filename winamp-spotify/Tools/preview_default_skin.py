#!/usr/bin/env python3
"""Render a preview of the built-in skin and the classic layout table.

This mirrors DefaultSkin.swift and SkinLayout.classic in Python so the geometry
can be checked without a Mac: it catches sprites that land in the wrong place,
overlap, or fall outside the 275x116 window. It is a verification aid, not part
of the app, and it will drift if the Swift palette or layout changes -- re-check
both sides if you edit either.

    python3 Tools/preview_default_skin.py docs/default-skin-preview.png
"""

import os, struct, sys, zlib

W, H = 275, 116

# --- Palette (mirrors DefaultSkin.Palette) ---------------------------------
FACE_HIGH   = (86, 92, 99)
FACE_MID    = (54, 58, 64)
FACE_LOW    = (34, 37, 41)
FACE_SHADOW = (18, 19, 21)
BEVEL_LIGHT = (122, 130, 139)
BEVEL_DARK  = (14, 15, 17)
LCD_BG      = (8, 14, 11)
LCD_BRIGHT  = (66, 255, 122)
LCD_DIM     = (22, 86, 44)
TITLE_A_TOP = (74, 82, 90)
TITLE_A_BOT = (38, 42, 47)
ACCENT      = (0, 214, 96)


class Canvas:
    def __init__(self, w, h, fill=None):
        self.w, self.h = w, h
        self.px = [[fill or (0, 0, 0) for _ in range(w)] for _ in range(h)]
        self.alpha = [[255 if fill else 0 for _ in range(w)] for _ in range(h)]

    def set(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[y][x] = c
            self.alpha[y][x] = 255

    def fill(self, x, y, w, h, c):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.set(xx, yy, c)

    def bevel(self, x, y, w, h, light, dark, raised=True):
        tl, br = (light, dark) if raised else (dark, light)
        for xx in range(x, x + w):
            self.set(xx, y, tl); self.set(xx, y + h - 1, br)
        for yy in range(y, y + h):
            self.set(x, yy, tl); self.set(x + w - 1, yy, br)

    def vgrad(self, x, y, w, h, top, bottom):
        for row in range(h):
            t = 0 if h == 1 else row / (h - 1)
            c = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
            for xx in range(x, x + w):
                self.set(xx, y + row, c)

    def stamp(self, rows, x, y, c):
        for ry, row in enumerate(rows):
            for rx, ch in enumerate(row):
                if ch == "#":
                    self.set(x + rx, y + ry, c)

    def blit(self, other, x, y):
        for ry in range(other.h):
            for rx in range(other.w):
                if other.alpha[ry][rx]:
                    self.set(x + rx, y + ry, other.px[ry][rx])


# --- Font -------------------------------------------------------------------
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from font_art import GLYPHS  # noqa: E402  (the source DefaultFontArt.swift is generated from)

FOLD = {"‘": "'", "’": "'", "–": "-", "—": "-", ",": ".", ";": "."}

def text(canvas, s, x, y, c, pitch=5):
    for i, ch in enumerate(s):
        g = GLYPHS.get(ch) or GLYPHS.get(ch.upper()) or GLYPHS.get(FOLD.get(ch, " "))
        if g:
            canvas.stamp(g, x + i * pitch, y, c)


# --- Sprite builders (mirror DefaultSkin) -----------------------------------

def recess(c, x, y, w, h):
    c.fill(x, y, w, h, LCD_BG)
    c.bevel(x, y, w, h, BEVEL_LIGHT, BEVEL_DARK, raised=False)

def raised(c, x, y, w, h):
    c.vgrad(x, y, w, h, FACE_HIGH, FACE_MID)
    c.bevel(x, y, w, h, BEVEL_LIGHT, BEVEL_DARK, raised=True)

def title_bar():
    c = Canvas(275, 14)
    c.vgrad(0, 0, 275, 14, TITLE_A_TOP, TITLE_A_BOT)
    c.bevel(0, 0, 275, 14, BEVEL_LIGHT, BEVEL_DARK)
    label = "WINAMP SPOTIFY"
    tw = len(label) * 5
    text(c, label, (275 - tw) // 2, 4, LCD_BRIGHT)
    for x in range(24, (275 - tw) // 2 - 6, 2):
        for y in range(4, 10, 2):
            c.set(x, y, FACE_HIGH)
    for x in range((275 + tw) // 2 + 6, 238, 2):
        for y in range(4, 10, 2):
            c.set(x, y, FACE_HIGH)
    return c

def main_background():
    c = Canvas(W, H)
    c.vgrad(0, 0, W, H, FACE_MID, FACE_LOW)
    c.bevel(0, 0, W, H, BEVEL_LIGHT, BEVEL_DARK)
    c.blit(title_bar(), 0, 0)
    recess(c, 20, 24, 84, 38)
    recess(c, 105, 24, 165, 30)
    raised(c, 105, 55, 164, 17)
    raised(c, 12, 85, 251, 24)
    recess(c, 14, 70, 252, 14)
    for y in (29, 30, 34, 35):
        c.set(73, y, LCD_DIM)
    text(c, "KBPS", 128, 43, FACE_HIGH)
    text(c, "KHZ", 168, 43, FACE_HIGH)
    return c

TRANSPORT = {
    "play":  ["#....", "##...", "###..", "####.", "###..", "##...", "#...."],
    "pause": ["##.##"] * 7,
    "stop":  ["#####"] * 7,
    "previous": ["#...#....#", "#..##...##", "#.###..###", "#####.####",
                 "#.###..###", "#..##...##", "#...#....#"],
    "next": ["#....#...#", "##...##..#", "###..###.#", "####.#####",
             "###..###.#", "##...##..#", "#....#...#"],
    "eject": ["..#..", ".###.", "#####", ".....", "#####"],
}

def transport_button(icon, w, h, pressed=False):
    c = Canvas(w, h)
    c.vgrad(0, 0, w, h, FACE_LOW if pressed else FACE_HIGH,
            FACE_SHADOW if pressed else FACE_MID)
    c.bevel(0, 0, w, h, BEVEL_LIGHT, BEVEL_DARK, raised=not pressed)
    art = TRANSPORT[icon]
    off = 1 if pressed else 0
    c.stamp(art, (w - len(art[0])) // 2 + off, (h - len(art)) // 2 + off,
            ACCENT if pressed else LCD_BRIGHT)
    return c

def label_button(label, w, h, on=False, pressed=False, pitch=5):
    c = Canvas(w, h)
    c.vgrad(0, 0, w, h, FACE_LOW if pressed else FACE_HIGH,
            FACE_SHADOW if pressed else FACE_MID)
    c.bevel(0, 0, w, h, BEVEL_LIGHT, BEVEL_DARK, raised=not pressed)
    tw = len(label) * pitch
    text(c, label, max(1, (w - tw) // 2 + (1 if pressed else 0)),
         (h - 6) // 2 + (1 if pressed else 0), ACCENT if on else FACE_SHADOW, pitch)
    if on and w >= 20:
        c.set(w - 4, 2, ACCENT); c.set(w - 3, 2, ACCENT)
    return c

def position_track():
    c = Canvas(248, 10)
    c.fill(0, 0, 248, 10, FACE_LOW)
    c.bevel(0, 3, 248, 4, BEVEL_DARK, BEVEL_LIGHT, raised=False)
    c.fill(1, 4, 246, 2, LCD_BG)
    return c

def slider_thumb(w, h, pressed=False):
    c = Canvas(w, h)
    c.vgrad(0, 0, w, h, FACE_MID if pressed else BEVEL_LIGHT,
            FACE_SHADOW if pressed else FACE_MID)
    c.bevel(0, 0, w, h, BEVEL_LIGHT, BEVEL_DARK, raised=not pressed)
    for y in range(2, h - 2):
        c.set(w // 2, y, ACCENT if pressed else FACE_SHADOW)
    return c

def slider_track(w, h, frame, centered=False):
    c = Canvas(w, h)
    c.fill(0, 0, w, h, FACE_LOW)
    c.bevel(0, 0, w, h, BEVEL_LIGHT, BEVEL_DARK, raised=False)
    tx, ty, tw, th = 2, 4, w - 4, h - 8
    c.fill(tx, ty, tw, th, LCD_BG)
    frac = frame / 27
    if centered:
        half = tw // 2
        extent = round(abs(frac - 0.5) * 2 * half)
        origin = tx + half - extent if frac < 0.5 else tx + half
        c.fill(origin, ty, max(1, extent), th, LCD_DIM)
    else:
        filled = round(frac * tw)
        if filled:
            c.fill(tx, ty, filled, th, (214, 118, 48) if frac > 0.85 else LCD_DIM)
    return c

STATUS = {"playing": ["#..", "##.", "###", "##.", "#.."],
          "paused":  ["#.#"] * 5,
          "stopped": ["###"] * 5}

def status_indicator(kind):
    c = Canvas(9, 9)
    c.stamp(STATUS[kind], 2, 2, LCD_DIM if kind == "stopped" else LCD_BRIGHT)
    return c

def channel_label(label, w, on):
    c = Canvas(w, 12)
    text(c, label, 0, 3, LCD_BRIGHT if on else LCD_DIM, 5)
    return c

def clutter_bar():
    c = Canvas(8, 43)
    c.fill(0, 0, 8, 43, FACE_LOW)
    c.bevel(0, 0, 8, 43, BEVEL_LIGHT, BEVEL_DARK, raised=False)
    for i, letter in enumerate("OAIDV"):
        text(c, letter, 1, 2 + i * 8, LCD_DIM)
    return c

SEGMENTS = {0: "ABCDEF", 1: "BC", 2: "ABDEG", 3: "ABCDG", 4: "BCFG",
            5: "ACDFG", 6: "ACDEFG", 7: "ABC", 8: "ABCDEFG", 9: "ABCDFG"}

def digit(value):
    c = Canvas(9, 13)
    lit = set(SEGMENTS.get(value, "")) if value is not None else set()
    bars = [("A", 1, 0, 7, 2), ("B", 7, 1, 2, 6), ("C", 7, 7, 2, 6),
            ("D", 1, 11, 7, 2), ("E", 0, 7, 2, 6), ("F", 0, 1, 2, 6),
            ("G", 1, 6, 7, 2)]
    for name, x, y, w, h in bars:
        c.fill(x, y, w, h, LCD_BRIGHT if name in lit else LCD_BG)
    return c


# --- Compose, using SkinLayout.classic --------------------------------------
LAYOUT = {
    "statusIndicator": (24, 28, 9, 9),
    "timeDisplay": (48, 26, 51, 13),
    "songTitle": (111, 27, 154, 6),
    "visualizer": (24, 43, 76, 16),
    "bitrate": (111, 43, 15, 6),
    "sampleRate": (156, 43, 10, 6),
    "monoIndicator": (212, 41, 27, 12),
    "stereoIndicator": (239, 41, 29, 12),
    "volumeSlider": (107, 57, 68, 13),
    "balanceSlider": (177, 57, 38, 13),
    "positionBar": (16, 72, 248, 10),
    "buttonPrevious": (16, 88, 23, 18),
    "buttonPlay": (39, 88, 23, 18),
    "buttonPause": (62, 88, 23, 18),
    "buttonStop": (85, 88, 23, 18),
    "buttonNext": (108, 88, 22, 18),
    "buttonEject": (136, 89, 22, 16),
    "buttonShuffle": (164, 89, 47, 15),
    "buttonRepeat": (210, 89, 28, 15),
    "buttonEqualizer": (219, 58, 23, 12),
    "buttonPlaylist": (242, 58, 23, 12),
    "buttonMenu": (6, 3, 9, 9),
    "buttonMinimize": (244, 3, 9, 9),
    "buttonShade": (254, 3, 9, 9),
    "buttonClose": (264, 3, 9, 9),
    "clutterBar": (10, 22, 8, 43),
}
TIME_DIGIT_X = [48, 60, 78, 90]

def title_button(glyph, pressed=False):
    c = Canvas(9, 9)
    c.fill(0, 0, 9, 9, FACE_LOW if pressed else FACE_MID)
    c.bevel(0, 0, 9, 9, BEVEL_LIGHT, BEVEL_DARK, raised=not pressed)
    c.stamp(glyph, 3, 3, FACE_HIGH)
    return c

def compose():
    c = main_background()

    c.blit(clutter_bar(), *LAYOUT["clutterBar"][:2])
    c.blit(title_button(["###", "...", "###"]), *LAYOUT["buttonMenu"][:2])
    c.blit(title_button(["...", "...", "###"]), *LAYOUT["buttonMinimize"][:2])
    c.blit(title_button(["###", "...", "..."]), *LAYOUT["buttonShade"][:2])
    c.blit(title_button(["#.#", ".#.", "#.#"]), *LAYOUT["buttonClose"][:2])

    c.blit(status_indicator("playing"), *LAYOUT["statusIndicator"][:2])

    # Clock at 1:23.
    for x, value in zip(TIME_DIGIT_X, [0, 1, 2, 3]):
        c.blit(digit(value), x, LAYOUT["timeDisplay"][1])

    tx, ty, tw, _ = LAYOUT["songTitle"]
    text(c, "PORTISHEAD - GLORY BOX"[: tw // 5], tx, ty, LCD_BRIGHT)

    text(c, "320", LAYOUT["bitrate"][0], LAYOUT["bitrate"][1], LCD_BRIGHT)
    text(c, "44", LAYOUT["sampleRate"][0], LAYOUT["sampleRate"][1], LCD_BRIGHT)
    c.blit(channel_label("MONO", 27, False), *LAYOUT["monoIndicator"][:2])
    c.blit(channel_label("STEREO", 29, True), *LAYOUT["stereoIndicator"][:2])

    # Visualiser: a plausible spectrum, to check the well's bounds.
    vx, vy, vw, vh = LAYOUT["visualizer"]
    c.fill(vx, vy, vw, vh, (0, 0, 0))
    ramp = [(24, 132, 8), (41, 148, 0), (57, 181, 16), (148, 222, 33),
            (189, 222, 41), (214, 181, 33), (222, 165, 24), (214, 115, 0),
            (214, 90, 0), (239, 49, 16)]
    heights = [13, 11, 15, 9, 12, 7, 10, 6, 8, 5, 7, 4, 6, 3, 5, 3, 4, 2, 3]
    for i, bh in enumerate(heights):
        bx = vx + i * 4
        if bx >= vx + vw:
            break
        for row in range(min(bh, vh)):
            colour = ramp[min(len(ramp) - 1, int(row / max(1, vh - 1) * (len(ramp) - 1)))]
            c.fill(bx, vy + vh - 1 - row, min(3, vx + vw - bx), 1, colour)
        peak = min(vh - 1, bh + 1)
        c.fill(bx, vy + vh - 1 - peak, min(3, vx + vw - bx), 1, (255, 255, 255))

    px, py, pw, _ = LAYOUT["positionBar"]
    c.blit(position_track(), px, py)
    c.blit(slider_thumb(29, 10), px + round(0.42 * (pw - 29)), py)

    vsx, vsy, vsw, _ = LAYOUT["volumeSlider"]
    c.blit(slider_track(68, 13, 20), vsx, vsy)
    c.blit(slider_thumb(14, 11), vsx + round(0.74 * (vsw - 14)), vsy + 1)

    bsx, bsy, bsw, _ = LAYOUT["balanceSlider"]
    c.blit(slider_track(38, 13, 13, centered=True), bsx, bsy)
    c.blit(slider_thumb(14, 11), bsx + round(0.5 * (bsw - 14)), bsy + 1)

    c.blit(label_button("EQ", 23, 12, on=True), *LAYOUT["buttonEqualizer"][:2])
    c.blit(label_button("PL", 23, 12, on=True), *LAYOUT["buttonPlaylist"][:2])

    for name, icon in [("buttonPrevious", "previous"), ("buttonPlay", "play"),
                       ("buttonPause", "pause"), ("buttonStop", "stop"),
                       ("buttonNext", "next"), ("buttonEject", "eject")]:
        x, y, w, h = LAYOUT[name]
        c.blit(transport_button(icon, w, h, pressed=(name == "buttonPlay")), x, y)

    sx, sy, sw, sh = LAYOUT["buttonShuffle"]
    c.blit(label_button("SHUFFLE", sw, sh, on=True), sx, sy)
    rx, ry, rw, rh = LAYOUT["buttonRepeat"]
    c.blit(label_button("RPT", rw, rh, on=False), rx, ry)

    return c


def write_png(canvas, path, scale=3):
    w, h = canvas.w * scale, canvas.h * scale
    rows = bytearray()
    for y in range(h):
        rows.append(0)
        src = canvas.px[y // scale]
        for x in range(w):
            rows += bytes(src[x // scale])
    def chunk(tag, data):
        return (struct.pack(">I", len(data)) + tag + data
                + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))
    png = (b"\x89PNG\r\n\x1a\n"
           + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
           + chunk(b"IDAT", zlib.compress(bytes(rows), 9))
           + chunk(b"IEND", b""))
    open(path, "wb").write(png)
    return w, h


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "docs/default-skin-preview.png"
    canvas = compose()
    size = write_png(canvas, out)
    print(f"wrote {out} at {size[0]}x{size[1]} (3x of {W}x{H})")
