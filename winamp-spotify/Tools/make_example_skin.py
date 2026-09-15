#!/usr/bin/env python3
"""Builds Skins/Amber CRT.wskin -- a worked example of the modern skin format.

Reuses the sprite builders in preview_default_skin.py with a different palette,
packs every sprite onto one sheet, and writes the skin.json that maps them. The
point is to exercise the whole ModernSkinLoader path: named sprites, indexed
frame strips (volume, balance, digits, the font grid), playlist colours, a
24-entry visualiser palette, and a region.txt-equivalent window shape.

    python3 Tools/make_example_skin.py
"""

import importlib.util, json, os, struct, sys, zipfile, zlib

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

spec = importlib.util.spec_from_file_location(
    "preview", os.path.join(HERE, "preview_default_skin.py")
)
preview = importlib.util.module_from_spec(spec)
spec.loader.exec_module(preview)

# --- Amber CRT palette ------------------------------------------------------
# Same structure as DefaultSkin.Palette, warmer: a phosphor-amber terminal.
preview.FACE_HIGH   = (92, 80, 66)
preview.FACE_MID    = (58, 50, 41)
preview.FACE_LOW    = (38, 32, 26)
preview.FACE_SHADOW = (20, 17, 14)
preview.BEVEL_LIGHT = (134, 118, 96)
preview.BEVEL_DARK  = (16, 13, 11)
preview.LCD_BG      = (16, 10, 4)
preview.LCD_BRIGHT  = (255, 178, 52)
preview.LCD_DIM     = (108, 68, 16)
preview.TITLE_A_TOP = (86, 74, 60)
preview.TITLE_A_BOT = (44, 37, 30)
preview.ACCENT      = (255, 140, 0)

Canvas = preview.Canvas

# --- Build every sprite -----------------------------------------------------

def build_sprites():
    """name -> Canvas, for the sprites addressed individually."""
    sprites = {}

    sprites["MAIN_BACKGROUND"] = preview.main_background()
    sprites["TITLE_BAR_ACTIVE"] = preview.title_bar()

    inactive = preview.title_bar()
    # Dim the inactive bar rather than drawing a second one.
    for y in range(inactive.h):
        for x in range(inactive.w):
            r, g, b = inactive.px[y][x]
            inactive.px[y][x] = (r * 2 // 3, g * 2 // 3, b * 2 // 3)
    sprites["TITLE_BAR_INACTIVE"] = inactive
    sprites["TITLE_BAR_EASTER_EGG_ACTIVE"] = sprites["TITLE_BAR_ACTIVE"]
    sprites["TITLE_BAR_EASTER_EGG_INACTIVE"] = inactive

    for name, active in (("SHADE_BACKGROUND_ACTIVE", True), ("SHADE_BACKGROUND_INACTIVE", False)):
        shade = preview.title_bar() if active else inactive
        c = Canvas(275, 14)
        c.blit(shade, 0, 0)
        preview.recess(c, 78, 3, 62, 9)
        sprites[name] = c

    title_glyphs = {
        "BUTTON_MENU": ["###", "...", "###"],
        "BUTTON_MINIMIZE": ["...", "...", "###"],
        "BUTTON_SHADE": ["###", "...", "..."],
        "BUTTON_CLOSE": ["#.#", ".#.", "#.#"],
    }
    for name, glyph in title_glyphs.items():
        sprites[name] = preview.title_button(glyph)
        sprites[name + "_PRESSED"] = preview.title_button(glyph, pressed=True)

    transport = {
        "BUTTON_PREVIOUS": ("previous", 23, 18),
        "BUTTON_PLAY": ("play", 23, 18),
        "BUTTON_PAUSE": ("pause", 23, 18),
        "BUTTON_STOP": ("stop", 23, 18),
        "BUTTON_NEXT": ("next", 22, 18),
        "BUTTON_EJECT": ("eject", 22, 16),
    }
    for name, (icon, w, h) in transport.items():
        sprites[name] = preview.transport_button(icon, w, h)
        sprites[name + "_PRESSED"] = preview.transport_button(icon, w, h, pressed=True)

    for state, on in (("OFF", False), ("ON", True)):
        sprites[f"SHUFFLE_{state}"] = preview.label_button("SHUFFLE", 47, 15, on=on)
        sprites[f"SHUFFLE_{state}_PRESSED"] = preview.label_button("SHUFFLE", 47, 15, on=on, pressed=True)
        sprites[f"REPEAT_{state}"] = preview.label_button("RPT", 28, 15, on=on)
        sprites[f"REPEAT_{state}_PRESSED"] = preview.label_button("RPT", 28, 15, on=on, pressed=True)
        sprites[f"BUTTON_EQUALIZER_{state}"] = preview.label_button("EQ", 23, 12, on=on)
        sprites[f"BUTTON_PLAYLIST_{state}"] = preview.label_button("PL", 23, 12, on=on)

    sprites["POSITION_BAR_BACKGROUND"] = preview.position_track()
    sprites["POSITION_BAR_THUMB"] = preview.slider_thumb(29, 10)
    sprites["POSITION_BAR_THUMB_PRESSED"] = preview.slider_thumb(29, 10, pressed=True)
    sprites["VOLUME_THUMB"] = preview.slider_thumb(14, 11)
    sprites["VOLUME_THUMB_PRESSED"] = preview.slider_thumb(14, 11, pressed=True)
    sprites["BALANCE_THUMB"] = preview.slider_thumb(14, 11)
    sprites["BALANCE_THUMB_PRESSED"] = preview.slider_thumb(14, 11, pressed=True)

    sprites["STATUS_PLAYING"] = preview.status_indicator("playing")
    sprites["STATUS_PAUSED"] = preview.status_indicator("paused")
    sprites["STATUS_STOPPED"] = preview.status_indicator("stopped")

    working = Canvas(3, 9)
    working.fill(0, 1, 3, 7, preview.ACCENT)
    sprites["STATUS_WORKING"] = working
    sprites["STATUS_NOT_WORKING"] = Canvas(3, 9, fill=preview.LCD_BG)

    sprites["MONO_ON"] = preview.channel_label("MONO", 27, True)
    sprites["MONO_OFF"] = preview.channel_label("MONO", 27, False)
    sprites["STEREO_ON"] = preview.channel_label("STEREO", 29, True)
    sprites["STEREO_OFF"] = preview.channel_label("STEREO", 29, False)

    sprites["CLUTTER_BAR"] = preview.clutter_bar()
    sprites["CLUTTER_BAR_DISABLED"] = preview.clutter_bar()

    # Playlist frame.
    def title_tile(w, label, active=True):
        c = Canvas(w, 20)
        top = preview.TITLE_A_TOP if active else tuple(v * 2 // 3 for v in preview.TITLE_A_TOP)
        bottom = preview.TITLE_A_BOT if active else tuple(v * 2 // 3 for v in preview.TITLE_A_BOT)
        c.vgrad(0, 0, w, 20, top, bottom)
        c.bevel(0, 0, w, 20, preview.BEVEL_LIGHT, preview.BEVEL_DARK)
        if label:
            preview.text(c, label, (w - len(label) * 5) // 2, 7,
                         preview.LCD_BRIGHT if active else preview.FACE_HIGH)
        return c

    for suffix, active in (("ACTIVE", True), ("INACTIVE", False)):
        sprites[f"PLAYLIST_TOP_LEFT_{suffix}"] = title_tile(25, None, active)
        sprites[f"PLAYLIST_TOP_TILE_{suffix}"] = title_tile(25, None, active)
        sprites[f"PLAYLIST_TOP_RIGHT_{suffix}"] = title_tile(25, None, active)
        sprites[f"PLAYLIST_TITLE_BAR_{suffix}"] = title_tile(100, "PLAYLIST", active)

    def edge(w):
        c = Canvas(w, 29)
        c.fill(0, 0, w, 29, preview.FACE_MID)
        c.bevel(0, 0, w, 29, preview.BEVEL_LIGHT, preview.BEVEL_DARK)
        return c

    sprites["PLAYLIST_LEFT_TILE"] = edge(12)
    sprites["PLAYLIST_RIGHT_TILE"] = edge(20)

    def bottom(w):
        c = Canvas(w, 38)
        c.vgrad(0, 0, w, 38, preview.FACE_MID, preview.FACE_LOW)
        c.bevel(0, 0, w, 38, preview.BEVEL_LIGHT, preview.BEVEL_DARK)
        return c

    sprites["PLAYLIST_BOTTOM_LEFT"] = bottom(125)
    sprites["PLAYLIST_BOTTOM_TILE"] = bottom(25)
    sprites["PLAYLIST_BOTTOM_RIGHT"] = bottom(150)
    sprites["PLAYLIST_SCROLL_THUMB"] = preview.slider_thumb(8, 18)
    sprites["PLAYLIST_SCROLL_THUMB_PRESSED"] = preview.slider_thumb(8, 18, pressed=True)
    sprites["PLAYLIST_CLOSE_BUTTON"] = preview.title_button(["#.#", ".#.", "#.#"])
    sprites["PLAYLIST_SHADE_BUTTON"] = preview.title_button(["###", "...", "..."])

    return sprites


def build_strips():
    """name -> (frames, columns) for the indexed frame strips."""
    volume = [preview.slider_track(68, 13, frame) for frame in range(28)]
    balance = [preview.slider_track(38, 13, frame, centered=True) for frame in range(28)]
    digits = [preview.digit(value) for value in range(10)] + [preview.digit(None)]

    from font_art import GLYPHS, ROWS
    font = []
    for row in ROWS:
        characters = list(row)
        for column in range(31):
            cell = Canvas(5, 6)
            if column < len(characters):
                art = GLYPHS.get(characters[column])
                if art:
                    cell.stamp(art, 0, 0, preview.LCD_BRIGHT)
            font.append(cell)

    return {
        "VOLUME_BACKGROUND": (volume, None),
        "BALANCE_BACKGROUND": (balance, None),
        "DIGITS": (digits, None),
        "FONT": (font, 31),
    }


# --- Pack onto one sheet ----------------------------------------------------

def pack(sprites, strips, sheet_width=512):
    """Shelf-packs everything into one sheet and records where it landed."""
    placements = {}
    items = []

    for name, canvas in sprites.items():
        items.append(("sprite", name, [canvas], None))
    for name, (frames, columns) in strips.items():
        items.append(("strip", name, frames, columns))

    # Tallest first: a shelf packer wastes far less that way.
    items.sort(key=lambda item: -max(frame.h for frame in item[2]))

    x = y = shelf_height = 0
    rows = []  # (canvas, x, y)

    for kind, name, frames, columns in items:
        if kind == "sprite":
            canvas = frames[0]
            if x + canvas.w > sheet_width:
                x, y = 0, y + shelf_height + 1
                shelf_height = 0
            rows.append((canvas, x, y))
            placements[name] = {"sheet": "main", "x": x, "y": y,
                                "width": canvas.w, "height": canvas.h}
            x += canvas.w + 1
            shelf_height = max(shelf_height, canvas.h)
        else:
            frame_w, frame_h = frames[0].w, frames[0].h
            grid_columns = columns or 1
            grid_rows = (len(frames) + grid_columns - 1) // grid_columns
            block_w = grid_columns * frame_w
            block_h = grid_rows * frame_h
            # Blocks get their own shelf: simpler, and the sheet is tiny anyway.
            x, y = 0, y + shelf_height + 1
            shelf_height = block_h
            for index, frame in enumerate(frames):
                fx = x + (index % grid_columns) * frame_w
                fy = y + (index // grid_columns) * frame_h
                rows.append((frame, fx, fy))
            entry = {"sheet": "main", "x": x, "y": y,
                     "width": frame_w, "height": frame_h, "count": len(frames)}
            if columns:
                entry["columns"] = columns
            else:
                entry["stepY"] = frame_h
            placements[name] = entry
            x = block_w + 1

    sheet_height = y + shelf_height + 1
    sheet = Canvas(sheet_width, sheet_height)
    for canvas, cx, cy in rows:
        sheet.blit(canvas, cx, cy)
    return sheet, placements, sheet_height


def write_png(canvas, path):
    """RGBA PNG: transparent wherever nothing was drawn."""
    raw = bytearray()
    for y in range(canvas.h):
        raw.append(0)
        for x in range(canvas.w):
            r, g, b = canvas.px[y][x]
            a = canvas.alpha[y][x]
            raw += bytes((r, g, b, a))

    def chunk(tag, data):
        return (struct.pack(">I", len(data)) + tag + data
                + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))

    png = (b"\x89PNG\r\n\x1a\n"
           + chunk(b"IHDR", struct.pack(">IIBBBBB", canvas.w, canvas.h, 8, 6, 0, 0, 0))
           + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
           + chunk(b"IEND", b""))
    with open(path, "wb") as handle:
        handle.write(png)
    return len(png)


def hexcolor(rgb):
    return "#%02X%02X%02X" % rgb


def main():
    sprites = build_sprites()
    strips = build_strips()
    sheet, placements, _ = pack(sprites, strips)

    sprite_rects = {name: rect for name, rect in placements.items() if name not in strips}
    strip_rects = {name: placements[name] for name in strips}

    # Rounded corners, the same shape region.txt describes: a flat polygon
    # stream per shape, in layout pixels.
    def rounded(width, height, inset=3):
        return [
            inset, 0, width - inset, 0,
            width, inset, width, height - inset,
            width - inset, height, inset, height,
            0, height - inset, 0, inset,
        ]

    ramp = [
        (24, 132, 8), (41, 148, 0), (49, 156, 8), (57, 181, 16),
        (108, 68, 16), (140, 90, 20), (170, 110, 24), (200, 130, 28),
        (220, 145, 32), (235, 158, 38), (245, 168, 44), (255, 178, 52),
        (255, 190, 70), (255, 200, 92), (255, 212, 120), (255, 224, 150),
    ]
    vis_colors = [hexcolor(preview.LCD_BG), hexcolor((48, 36, 24))]
    vis_colors += [hexcolor(c) for c in ramp]
    vis_colors += [hexcolor((255, 178, 52)), hexcolor((235, 158, 38)),
                   hexcolor((255, 190, 70)), hexcolor((255, 178, 52)),
                   hexcolor((220, 145, 32))]
    vis_colors.append("#FFFFFF")

    manifest = {
        "format": "winamp-spotify-skin",
        "version": 1,
        "name": "Amber CRT",
        "author": "Winamp Spotify",
        "assetScale": 1,
        "sheets": {"main": "sheet.png"},
        "sprites": sprite_rects,
        "strips": strip_rects,
        "playlist": {
            "normalText": hexcolor(preview.LCD_BRIGHT),
            "currentText": "#FFFFFF",
            "background": hexcolor(preview.LCD_BG),
            "selectedBackground": hexcolor((84, 52, 12)),
        },
        # Optional: correct individual colours of the palette that would
        # otherwise be derived from the artwork. Omit the block entirely and
        # everything here is inferred -- this is here to exercise the override
        # path and to document it.
        "theme": {
            "accent": hexcolor(preview.ACCENT),
            "faceText": hexcolor(preview.LCD_BRIGHT),
            "listFontName": "Menlo",
        },
        "visualizerColors": vis_colors,
        "regions": {
            "normal": [rounded(275, 116)],
            "windowshade": [rounded(275, 14, inset=2)],
        },
    }

    out_dir = os.path.join(ROOT, "Skins")
    os.makedirs(out_dir, exist_ok=True)
    sheet_path = os.path.join(out_dir, "sheet.png")
    write_png(sheet, sheet_path)

    skin_path = os.path.join(out_dir, "Amber CRT.wskin")
    with zipfile.ZipFile(skin_path, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.write(sheet_path, "sheet.png")
        archive.writestr("skin.json", json.dumps(manifest, indent=2, sort_keys=True))
    os.remove(sheet_path)

    print(f"wrote {skin_path}")
    print(f"  sheet {sheet.w}x{sheet.h}, {len(sprite_rects)} sprites, {len(strip_rects)} strips")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
