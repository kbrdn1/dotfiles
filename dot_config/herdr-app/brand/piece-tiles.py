# brand/piece-tiles.py (#93): the square of a piece's card in the Chat (36 px, rx 8) as a neutral dithered tile,
# like projects-dither.py's logo backgrounds, one motif per family, one file per family and appearance:
# mods/kt-chat/tiles/<family>-<dark|light>.svg, which kt-chat draws as they are (att-model.js tileOf), never
# working one out in its render. 18 cells of 2 px, so it stays sharp at 1x and 2x (24 would be 1.5 px).
# The ramp runs from the top left to the bottom right in 4 grays, Bayer 8x8 between neighbours (as
# projects-dither.py); the family's motif goes one step lighter (darker in light), fading along the same
# diagonal: Bayer for a document, a grid for a spreadsheet, lines for text, diagonals for code, a halftone for
# an image without its thumbnail, nothing for the rest. The extension is written over it by kt-chat.
#   python3 brand/piece-tiles.py [out dir]   (default: mods/kt-chat/tiles beside brand/)
import pathlib, sys
B = [[0,32,8,40,2,34,10,42],[48,16,56,24,50,18,58,26],[12,44,4,36,14,46,6,38],[60,28,52,20,62,30,54,22],
     [3,35,11,43,1,33,9,41],[51,19,59,27,49,17,57,25],[15,47,7,39,13,45,5,37],[63,31,55,23,61,29,53,21]]
N, LEVELS = 18, 4
THEMES = {  # the ramp's top left, its bottom right, the motif
    "dark": ("#303030", "#222222", "#3c3c3c"),
    "light": ("#e2e2e2", "#d2d2d2", "#c6c6c6"),
}

def mix(a, b, t):
    a = [int(a[i:i+2], 16) for i in (1, 3, 5)]; b = [int(b[i:i+2], 16) for i in (1, 3, 5)]
    return "#" + "".join(f"{round(x + (y - x) * t):02x}" for x, y in zip(a, b))

def ramp(x, y):  # 0 (the light end) .. LEVELS-1, Bayer-dithered between neighbours
    v = (x + y) / (2 * (N - 1)) * (LEVELS - 1); k = int(v)
    return k + 1 if k < LEVELS - 1 and v - k > (B[y % 8][x % 8] + 0.5) / 64 else k

def bayer(x, y, density):  # this cell lit at this density (0..1)
    return (B[y % 8][x % 8] + 0.5) / 64 < density

fade = lambda x, y: 1 - (x + y) / (2 * (N - 1))  # 1 at the top left, 0 at the bottom right
MOTIFS = {
    "doc": lambda x, y: bayer(x, y, 0.55 * fade(x, y)),
    "sheet": lambda x, y: (x % 4 == 1 or y % 4 == 1) and bayer(x, y, 0.35 + 0.6 * fade(x, y)),
    "text": lambda x, y: y % 3 == 1 and 1 < x < N - 2 - (y * 5) % 7,
    "code": lambda x, y: (x + y) % 4 == 0 and bayer(x, y, 0.4 + 0.6 * fade(x, y)),
    "image": lambda x, y: ((x % 6 - 2.5) ** 2 + (y % 6 - 2.5) ** 2) ** 0.5 < 0.8 + 1.6 * fade(x, y),
    "other": lambda x, y: False,
}

def tile(family, theme):
    a, b, m = THEMES[theme]
    tones = [mix(a, b, k / (LEVELS - 1)) for k in range(LEVELS)]
    runs = {}
    for y in range(N):
        for x in range(N):
            c = m if MOTIFS[family](x, y) else tones[ramp(x, y)]
            runs.setdefault(c, []).append(f"M{x} {y}h1v1h-1z")
    paths = "".join(f'<path fill="{c}" d="{"".join(d)}"/>' for c, d in runs.items())
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {N} {N}" width="36" height="36" shape-rendering="crispEdges">'
            f'<clipPath id="r"><rect width="{N}" height="{N}" rx="4"/></clipPath><g clip-path="url(#r)">{paths}</g></svg>\n')

out = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path(__file__).resolve().parent.parent / "mods" / "kt-chat" / "tiles"
out.mkdir(parents=True, exist_ok=True)
for fam in MOTIFS:
    for th in THEMES:
        (out / f"{fam}-{th}.svg").write_text(tile(fam, th))
print(f"{len(MOTIFS) * len(THEMES)} tiles in {out}")
