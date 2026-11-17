# Transparent orange Bayer dither, after kbrdn.dev's DitherCanvas (4x4 Bayer, 4 alpha levels, top-to-bottom fade).
import math, random, struct, sys, zlib

W, H, CELL, DOT = 2400, 1500, 6, 4
RGB = (0xD4, 0x82, 0x5D)
ALPHAS = [0, 0.08, 0.16, 0.26]  # site: [0, .06, .12, .18], nudged up: only the gutters show it
BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]
random.seed(1)
waves = [(random.uniform(0.004, 0.02), random.uniform(0.004, 0.02), random.uniform(0, 6.28)) for _ in range(5)]

def field(x, y):
    v = sum(math.sin(x * a + y * b + p) for a, b, p in waves) / len(waves)
    fade = 1.0 if y < 0.65 * H else max(0.0, 1 - (y - 0.65 * H) / (0.35 * H))
    return max(0.0, min(1.0, (v + 0.6) / 1.4)) * fade

def level(cx, cy):
    q = field(cx * CELL, cy * CELL) * 3
    base = int(q)
    return min(3, base + (q - base > (BAYER[cy % 4][cx % 4] + 0.5) / 16))

cols = W // CELL
raw = bytearray()
for cy in range(H // CELL):
    dot_row = bytearray()
    for cx in range(cols):
        a = int(ALPHAS[level(cx, cy)] * 255)
        dot_row += bytes((*RGB, a)) * DOT + b"\0\0\0\0" * (CELL - DOT)
    blank = b"\0\0\0\0" * (cols * CELL)
    for r in range(CELL):
        raw += b"\0" + (dot_row if r < DOT else blank)

def chunk(kind, data):
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", cols * CELL, (H // CELL) * CELL, 8, 6, 0, 0, 0)) \
    + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")
open(sys.argv[1], "wb").write(png)
