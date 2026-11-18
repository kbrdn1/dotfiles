# brand/dither-corner.svg: the band's dither (2 px dots on a 4 px grid, levels .34/.67/1) as a glow from
# the top left corner instead of a band: dense in the corner, gone along an ellipse of W x H.
import math, sys
W, H = 480, 260
B = [[0,32,8,40,2,34,10,42],[48,16,56,24,50,18,58,26],[12,44,4,36,14,46,6,38],[60,28,52,20,62,30,54,22],
     [3,35,11,43,1,33,9,41],[51,19,59,27,49,17,57,25],[15,47,7,39,13,45,5,37],[63,31,55,23,61,29,53,21]]
levels = {".34": [], ".67": [], "1": []}
for y in range(0, H, 4):
    for x in range(0, W, 4):
        d = 1.12 * math.hypot((x + 1) / W, (y + 1) / H)
        i = max(0.0, 1 - d) ** 1.6
        t = (B[(y // 4) % 8][(x // 4) % 8] + 0.5) / 64
        if i <= t * 0.9: continue
        lv = "1" if i > 0.55 else ".67" if i > 0.28 else ".34"
        levels[lv].append(f"M{x} {y}h2v2h-2z")
parts = []
for lv in (".34", ".67", "1"):
    attr = "" if lv == "1" else f' fill-opacity="{lv}"'
    parts.append(f'<path{attr} d="{"".join(levels[lv])}"/>')
svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">{"".join(parts)}</svg>'
open(sys.argv[1], "w").write(svg)
print(len(svg), {k: len(v) for k, v in levels.items()})
