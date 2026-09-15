#!/usr/bin/env python3
"""The 5x6 pixel font for the built-in skin -- the single source of truth.

`Tools/generate_font_art.py` turns this into Sources/SkinKit/DefaultFontArt.swift,
and Tools/preview_default_skin.py reads it directly. Edit here, regenerate.

Cells are 5 wide and 6 tall. Ink stays within the first FOUR columns so that the
fifth is a built-in gutter: the renderer advances a fixed 5px per character with
no kerning, so a glyph that fills all five columns runs into its neighbour. M
and W are the deliberate exceptions -- they are unreadable in four columns, and
the original Winamp font crowds them too. The sixth row is the descender line,
left blank by every glyph here.

Run this file to print the sheet and eyeball it.
"""

GLYPHS = {
    # Row 0 of the sheet: A-Z, then " and @ and space.
    "A": [".##.", "#..#", "####", "#..#", "#..#", "...."],
    "B": ["###.", "#..#", "###.", "#..#", "###.", "...."],
    "C": [".##.", "#..#", "#...", "#..#", ".##.", "...."],
    "D": ["###.", "#..#", "#..#", "#..#", "###.", "...."],
    "E": ["####", "#...", "###.", "#...", "####", "...."],
    "F": ["####", "#...", "###.", "#...", "#...", "...."],
    "G": [".##.", "#...", "#.##", "#..#", ".##.", "...."],
    "H": ["#..#", "#..#", "####", "#..#", "#..#", "...."],
    "I": ["###.", ".#..", ".#..", ".#..", "###.", "...."],
    "J": ["..##", "...#", "...#", "#..#", ".##.", "...."],
    "K": ["#..#", "#.#.", "##..", "#.#.", "#..#", "...."],
    "L": ["#...", "#...", "#...", "#...", "####", "...."],
    "M": ["#...#", "##.##", "#.#.#", "#...#", "#...#", "....."],
    "N": ["#..#", "##.#", "#.##", "#..#", "#..#", "...."],
    "O": [".##.", "#..#", "#..#", "#..#", ".##.", "...."],
    "P": ["###.", "#..#", "###.", "#...", "#...", "...."],
    "Q": [".##.", "#..#", "#..#", "#.#.", ".#.#", "...."],
    "R": ["###.", "#..#", "###.", "#.#.", "#..#", "...."],
    "S": [".###", "#...", ".##.", "...#", "###.", "...."],
    "T": ["####", ".#..", ".#..", ".#..", ".#..", "...."],
    "U": ["#..#", "#..#", "#..#", "#..#", ".##.", "...."],
    "V": ["#..#", "#..#", "#..#", ".##.", ".##.", "...."],
    "W": ["#...#", "#...#", "#.#.#", "##.##", "#...#", "....."],
    "X": ["#..#", "#..#", ".##.", "#..#", "#..#", "...."],
    "Y": ["#..#", "#..#", ".##.", ".#..", ".#..", "...."],
    "Z": ["####", "..#.", ".#..", "#...", "####", "...."],
    '"': ["#.#.", "#.#.", "....", "....", "....", "...."],
    "@": [".##.", "#..#", "#.##", "#.##", ".##.", "...."],
    " ": ["....", "....", "....", "....", "....", "...."],

    # Row 1: digits, then punctuation.
    "0": [".##.", "#.##", "#.#.", "##.#", ".##.", "...."],
    "1": [".#..", "##..", ".#..", ".#..", "###.", "...."],
    "2": ["###.", "...#", ".##.", "#...", "####", "...."],
    "3": ["###.", "...#", ".##.", "...#", "###.", "...."],
    "4": ["#..#", "#..#", "####", "...#", "...#", "...."],
    "5": ["####", "#...", "###.", "...#", "###.", "...."],
    "6": [".##.", "#...", "###.", "#..#", ".##.", "...."],
    "7": ["####", "...#", "..#.", ".#..", ".#..", "...."],
    "8": [".##.", "#..#", ".##.", "#..#", ".##.", "...."],
    "9": [".##.", "#..#", ".###", "...#", ".##.", "...."],
    "…": ["....", "....", "....", "....", "#.#.", "...."],
    ":": ["....", ".#..", "....", ".#..", "....", "...."],
    "(": ["..#.", ".#..", ".#..", ".#..", "..#.", "...."],
    ")": [".#..", "..#.", "..#.", "..#.", ".#..", "...."],
    "-": ["....", "....", "###.", "....", "....", "...."],
    "'": [".#..", ".#..", "....", "....", "....", "...."],
    "!": [".#..", ".#..", ".#..", "....", ".#..", "...."],
    "_": ["....", "....", "....", "....", "####", "...."],
    "+": ["....", ".#..", "###.", ".#..", "....", "...."],
    "\\": ["#...", ".#..", ".#..", "..#.", "..#.", "...."],
    "/": ["..#.", "..#.", ".#..", "#...", "#...", "...."],
    "[": ["##..", "#...", "#...", "#...", "##..", "...."],
    "]": [".##.", "..#.", "..#.", "..#.", ".##.", "...."],
    "^": [".#..", "#.#.", "....", "....", "....", "...."],
    "&": [".##.", "#..#", ".##.", "#.#.", ".#.#", "...."],
    "%": ["#..#", "...#", ".##.", "#...", "#..#", "...."],
    ".": ["....", "....", "....", "....", ".#..", "...."],
    "=": ["....", "###.", "....", "###.", "....", "...."],
    "$": [".###", "##..", ".##.", "..##", "###.", "...."],
    "#": ["#.#.", "####", "#.#.", "####", "#.#.", "...."],

    # Row 2: the Nordic vowels and a couple of symbols the spec puts here.
    "Å": ["..#.", ".##.", "#..#", "####", "#..#", "...."],
    "Ö": ["#.#.", ".##.", "#..#", "#..#", ".##.", "...."],
    "Ä": ["#.#.", ".##.", "#..#", "####", "#..#", "...."],
    "?": ["###.", "...#", ".##.", "....", ".#..", "...."],
    "*": ["#.#.", ".#..", "#.#.", "....", "....", "...."],
}

# Sheet layout, matching BitmapFontLayout.rows in SkinKit.
ROWS = [
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ"@ ',
    "0123456789…:()-'!_+\\/[]^&%.=$#",
    "ÅÖÄ?* ",
]

CELL_WIDTH = 5
CELL_HEIGHT = 6


def validate():
    """Every glyph must be 6 rows, and no wider than the cell."""
    problems = []
    for char, art in GLYPHS.items():
        if len(art) != CELL_HEIGHT:
            problems.append(f"{char!r} has {len(art)} rows, expected {CELL_HEIGHT}")
        for row in art:
            if len(row) > CELL_WIDTH:
                problems.append(f"{char!r} row {row!r} is {len(row)} wide, max {CELL_WIDTH}")
    for row in ROWS:
        for char in row:
            if char not in GLYPHS:
                problems.append(f"sheet row references undefined glyph {char!r}")
    # Ink beyond column 3 costs the gutter; M and W accept that knowingly.
    for char, art in GLYPHS.items():
        if char in "MW":
            continue
        if any(len(row) > 4 and row[4] == "#" for row in art):
            problems.append(f"{char!r} has ink in the gutter column")
    return problems


def render_sheet():
    """Prints the sheet as it will be drawn, at the real 5px pitch."""
    lines = []
    for row in ROWS:
        for line in range(CELL_HEIGHT):
            out = ""
            for char in row:
                art = GLYPHS[char][line].ljust(CELL_WIDTH, ".")
                out += art[:CELL_WIDTH]
            lines.append(out.replace(".", " "))
        lines.append("")
    return "\n".join(lines)


if __name__ == "__main__":
    issues = validate()
    if issues:
        for issue in issues:
            print("PROBLEM:", issue)
        raise SystemExit(1)
    print(render_sheet())
    print("--- sample strings at real pitch ---")
    for sample in ["PORTISHEAD - GLORY BOX", "SHUFFLE", "STEREO", "WINAMP SPOTIFY",
                   "KBPS", "12 TRACKS 48:31"]:
        for line in range(CELL_HEIGHT - 1):
            print("".join(GLYPHS[c][line].ljust(CELL_WIDTH, ".")[:CELL_WIDTH]
                          for c in sample).replace(".", " "))
        print()
