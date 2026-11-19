# brand/projects-dither.py: the background of the project logos (24 square, rx 6) as a dithered ramp, from the
# project's colour at the top left to 30 % darker at the bottom right, in 4 tones dithered between neighbours
# (Bayer 8x8, like dither*.py), clipped to the rounded square. Rewrites each file in place; run again on a logo
# that is already dithered, it starts over from the colour noted in its dither comment.
#   python3 brand/projects-dither.py brand/projects/<name>.svg ...
import pathlib, re, sys
B = [[0,32,8,40,2,34,10,42],[48,16,56,24,50,18,58,26],[12,44,4,36,14,46,6,38],[60,28,52,20,62,30,54,22],
     [3,35,11,43,1,33,9,41],[51,19,59,27,49,17,57,25],[15,47,7,39,13,45,5,37],[63,31,55,23,61,29,53,21]]
LEVELS, DEPTH = 4, 0.30
FLAT = re.compile(r'<rect width="24" height="24" rx="6" fill="(#[0-9a-fA-F]{6})"\s*/>')
DONE = re.compile(r'<!-- dither (#[0-9a-f]{6}) -->.*?<!-- /dither -->', re.S)

def mix(c, to, a):
    c = [int(c[i:i+2], 16) for i in (1, 3, 5)]; t = [int(to[i:i+2], 16) for i in (1, 3, 5)]
    return "#" + "".join(f"{round(x + (y - x) * a):02x}" for x, y in zip(c, t))

def background(base, uid):
    tones = [mix(base, "#000000", DEPTH * k / (LEVELS - 1)) for k in range(LEVELS)]
    rows = {k: [] for k in range(1, LEVELS)}
    for y in range(24):
        run = None  # (tone, first x) of the current horizontal run
        for x in range(25):
            k = -1
            if x < 24:
                v = (x + y) / 46 * (LEVELS - 1); k = int(v)
                if k < LEVELS - 1 and v - k > (B[y % 8][x % 8] + 0.5) / 64: k += 1
            if run and run[0] != k:
                if run[0] > 0: rows[run[0]].append(f"M{run[1]} {y}h{x - run[1]}v1h-{x - run[1]}z")
                run = None
            if run is None and x < 24: run = (k, x)
    paths = "".join(f'<path fill="{tones[k]}" d="{"".join(d)}"/>' for k, d in rows.items() if d)
    return (f'<!-- dither {base} --><clipPath id="{uid}"><rect width="24" height="24" rx="6"/></clipPath>'
            f'<rect width="24" height="24" rx="6" fill="{tones[0]}"/><g clip-path="url(#{uid})">{paths}</g><!-- /dither -->')

for f in sys.argv[1:]:
    p = pathlib.Path(f); s = p.read_text()
    m = DONE.search(s) or FLAT.search(s)
    if not m:
        print(f"{f}: no rx 6 square background, left as is"); continue
    uid = "bg-" + re.sub(r"[^a-z0-9-]", "-", p.stem.lower())
    p.write_text(s[:m.start()] + background(m.group(1).lower(), uid) + s[m.end():])
    print(f"{f}: {m.group(1).lower()}")
