#!/usr/bin/env python3
"""Builds the companions: ../out/<theme>/<name>@<k>x.png, ../index.json, ../review.png, ../demo.gif,
../review-variants.png (the sub-agents' ten coiffes, #71).

    python3 -I ~/.config/herdr-app/brand/companions/src/build.py

Painted like the portfolio's cameos (kbrdn.dev-v2 app/utils/cameos/art.ts, see ../STYLE.md):
art pixels on a 20x16 grid, volumes in three tones lit from the top left with a checker dither
where two tones meet, a one-pixel outline round each layer, the site's palette, 85 ms poses.
Both characters are original drawings: Ember (Claude Code) and Prompt (Codex).
A body image per pose; accessories (what it does) are separate layers laid at an anchor.
"""
import json
import math
import os
import shutil
import struct
import subprocess
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "out")
APP = os.path.dirname(os.path.dirname(ROOT))  # ~/.config/herdr-app: icons/<key>.svg, mods/
# companion-logo.js's source is kt-threads' copy (kt-mods' SHARED): its DATA is written there, then every
# other copy (the mods', brand's) is made byte for byte from it
LOGO = os.path.join(APP, "mods", "kt-threads", "companion-logo.js")
W, H = 21, 16  # the body's canvas, art pixels: 21 x 1.5 css px fits a 32 px tile, 21 x 1 a 24 x 20 one
AW, AH = 10, 10  # an accessory's canvas
SCALES = [1, 2, 3, 4]  # device pixels per art pixel
FRAME = 85  # the cameos' pose cadence (ms); every cadence here is a multiple of it

# The site's palette (art.ts PAL, theme.css)
PAL = {
    "orange": "#d4825d", "rust": "#a64d2e", "cream": "#f8ddb8", "red": "#e06060", "pink": "#ff9aa8",
    "yellow": "#ffdf61", "gold": "#e6c654", "green": "#6bc97f", "blue": "#7ab8ff", "purple": "#c79bff",
    "cyan": "#8abfb8", "steel": "#999999", "paper": "#f5f5f5", "wood": "#a0673d",
}
OUTLINE = {"dark": "#0f0f0f", "light": "#242424"}  # art.ts outlineOf(dark)
INK = "#1a1a1a"  # neutral-950: eyes
SCREEN = ("#1a1a1a", "#242424", "#3a3a3a")  # neutral-950/900/700


# ── Colours (art.ts mix / shades)
def mix(a, b, p):
    x, y = int(a[1:], 16), int(b[1:], 16)
    ch = lambda n, s: (n >> s) & 255
    return "#" + "".join(f"{round(ch(x, s) + (ch(y, s) - ch(x, s)) * p):02x}" for s in (16, 8, 0))


def shades(base, dark=0.3, light=0.35):
    return (mix(base, "#000000", dark), base, mix(base, "#ffffff", light))


# ── A raster of art pixels (art.ts Raster)
def lighting(nx, ny, nz):
    return -0.45 * nx - 0.6 * ny + 0.66 * nz


def tone_of(light, x, y):
    l = light + ((x + y) & 1) * 0.08
    return 2 if l > 0.8 else 1 if l > 0.32 else 0


class Raster:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.c = [None] * (w * h)

    def at(self, x, y):
        x, y = math.floor(x), math.floor(y)
        return self.c[y * self.w + x] if 0 <= x < self.w and 0 <= y < self.h else None

    def set(self, x, y, col):
        x, y = math.floor(x), math.floor(y)
        if 0 <= x < self.w and 0 <= y < self.h:
            self.c[y * self.w + x] = col

    def clear(self, x, y):
        self.set(x, y, None)

    def rect(self, x, y, w, h, col):
        for j in range(h):
            for i in range(w):
                self.set(x + i, y + j, col)

    def ball(self, cx, cy, rx, ry, tones):
        for y in range(math.floor(cy - ry), math.ceil(cy + ry)):
            for x in range(math.floor(cx - rx), math.ceil(cx + rx)):
                nx, ny = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
                r = nx * nx + ny * ny
                if r <= 1:
                    self.set(x, y, tones[tone_of(lighting(nx, ny, math.sqrt(1 - r)), x, y)])

    def box(self, x, y, w, h, tones):
        """Lit on its top and left edges, shaded on its bottom and right ones."""
        for j in range(h):
            for i in range(w):
                self.set(x + i, y + j, tones[0 if (j == h - 1 or i == w - 1) else 2 if (j == 0 or i == 0) else 1])

    def dots(self, pts, col, dx=0, dy=0):
        for x, y in pts:
            self.set(x + dx, y + dy, col)

    def line(self, x0, y0, x1, y1, col):
        n = max(1, math.ceil(max(abs(x1 - x0), abs(y1 - y0))))
        for i in range(n + 1):
            self.set(x0 + (x1 - x0) * i / n + 0.5, y0 + (y1 - y0) * i / n + 0.5, col)

    def outline(self, col):
        edge = [(x, y) for y in range(self.h) for x in range(self.w)
                if not self.at(x, y) and (self.at(x - 1, y) or self.at(x + 1, y) or self.at(x, y - 1) or self.at(x, y + 1))]
        for x, y in edge:
            self.set(x, y, col)
        return self

    def rows(self):
        return [[self.c[y * self.w + x] for x in range(self.w)] for y in range(self.h)]


def png(path, rows, k):
    """rows of '#rrggbb' or None, each art pixel k x k device pixels, transparent elsewhere."""
    rgba = lambda c: struct.pack("4B", int(c[1:3], 16), int(c[3:5], 16), int(c[5:7], 16), 255) if c else b"\0\0\0\0"
    raw = b"".join((b"\0" + b"".join(rgba(c) * k for c in row)) * k for row in rows)
    w, h = len(rows[0]) * k, len(rows) * k
    chunk = lambda tag, data: struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
                + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


# ── The bodies. A pose: dy (lift, art px), sq (squash), dx (shake), eyes, arms (left, right), mouth.
POSES = {
    # rest and breath (static unless asked: idle draws nothing over time)
    "idle": [dict(), dict(sq=1)],
    "sleep": [dict(eyes="shut", sq=1), dict(eyes="shut")],
    # typing: bob, hands in turn
    "working": [dict(r="type1", l="type2"), dict(dy=-1, r="type2", l="type1")],
    # a hand up, waving it a little
    "blocked": [dict(r="up", eyes="wide"), dict(r="up2", eyes="wide")],
    # crouch, jump with both hands up, peak, land
    "done": [dict(sq=1, eyes="happy"), dict(dy=-1, l="up", r="up", eyes="happy", mouth="smile"),
             dict(dy=-2, l="up2", r="up2", eyes="happy", mouth="smile"), dict(sq=1, eyes="happy", mouth="smile")],
    # crossed eyes, slumping
    "error": [dict(eyes="x", mouth="o"), dict(eyes="x", mouth="o", sq=1)],
    # the click: a wave, once
    "wave": [dict(r="up", eyes="happy", mouth="smile"), dict(r="up2", eyes="happy", mouth="smile"),
             dict(r="up", eyes="happy", mouth="smile"), dict(r="up2", eyes="happy", mouth="smile")],
}
# cadence (ms) and whether it loops
TIMING = {"idle": (900, True), "sleep": (1190, True), "working": (255, True), "blocked": (340, True),
          "done": (FRAME + 25, False), "error": (170, True), "wave": (170, False)}
# How companion.js plays them in Herdr (measured in the lab, see the report):
#   loop   two frames swapped natively (an opacity square wave each, opposite phases): no script, no timer
#   once   every frame, once, stepped by a short timer.after chain (under a second), then the next state
#   static the first listed frame, nothing moves (idle, sleep and error never animate: CPU)
# A native loop of three or more frames (nested opacity bands) showed a ghosted frame in 1 burst shot of 24:
# loops keep two frames; the other frames are in the review sheet and the GIF.
BODY_PLAY = {"idle": ("static", [0]), "sleep": ("static", [0]), "working": ("loop", [0, 1]),
             "blocked": ("loop", [0, 1]), "done": ("once", [0, 1, 2, 3]), "error": ("static", [0]),
             "wave": ("once", [0, 1, 2, 3])}
ACC_PLAY = {"read": [0, 1], "edit": [0, 1], "bash": [0, 1], "web": [0, 2], "git": [0, 2], "tests": [0, 2],
            "think": [0, 2], "bang": [0, 1], "sparkle": [1, 2], "zzz": [2], "agent": [1, 2]}


def ember(pose):
    """Ember, for Claude Code: a round coal of the site's orange, a cream spark on its head."""
    dy, sq = pose.get("dy", 0), pose.get("sq", 0)
    art = Raster(W, H)
    body = shades(PAL["orange"])
    foot = shades(PAL["rust"], 0.25, 0.2)
    # feet stay on the ground when it lifts (stretch), the body squashes when it breathes
    art.box(4, 14, 2, 2, foot)
    art.box(10, 14, 2, 2, foot)
    top = 5 + dy + sq
    art.ball(8, (top + 14.6) / 2, 5.4, (14.6 - top) / 2, body)
    # the spark on its head: a little gem of cream, its middle lit
    spark = shades(PAL["cream"], 0.15, 0.6)
    sy = top - 1
    art.dots([(7, sy - 1), (8, sy - 1), (6, sy), (9, sy), (7, sy + 1), (8, sy + 1)], spark[1])
    art.dots([(7, sy), (8, sy)], spark[2])
    arms(art, pose, body, dy + sq // 2, (1, 13), 10)
    ey = 8 + dy + sq
    face(art, pose.get("eyes", "open"), [(5, ey), (10, ey)], INK)
    art.dots([(4, ey + 3), (11, ey + 3)], PAL["pink"])
    mouth(art, pose.get("mouth"), 7.5, ey + 3, INK)
    return art


def prompt(pose):
    """Prompt, for Codex: a pocket terminal of the site's blue, a dark screen whose face is a prompt."""
    dy, sq = pose.get("dy", 0), pose.get("sq", 0)
    art = Raster(W, H)
    body = shades(PAL["blue"])
    leg = shades(PAL["steel"], 0.3, 0.45)
    art.box(4, 13, 2, 3, leg)
    art.box(10, 13, 2, 3, leg)
    top = 5 + dy + sq
    art.box(3, top, 10, 14 - top, body)
    for x, y in [(3, top), (12, top), (3, 13), (12, 13)]:
        art.clear(x, y)
    # the antenna and its light
    art.set(8, top - 1, leg[1])
    art.set(8, top - 2, PAL["cyan"])
    arms(art, pose, body, dy + sq // 2, (1, 13), 9)
    art.box(4, top + 2, 8, 5, SCREEN)
    ey = top + 3
    eyes = pose.get("eyes", "open")
    green = mix(PAL["green"], "#ffffff", 0.15)
    if eyes == "open":  # >_
        art.dots([(5, ey - 1), (6, ey), (5, ey + 1), (8, ey + 1), (9, ey + 1), (10, ey + 1)], green)
    elif eyes == "wide":  # two round eyes, open wide
        art.dots([(5, ey - 1), (6, ey - 1), (5, ey), (6, ey), (9, ey - 1), (10, ey - 1), (9, ey), (10, ey)], green)
    else:
        face(art, eyes, [(6, ey), (9, ey)], PAL["red"] if eyes == "x" else green)
    return art


def arms(art, pose, tones, dy, xs, y):
    """Two nubs, left and right of the body: side, up, up2 (higher; the right one out), type1/2 (in front)."""
    lx, rx = xs
    for side, x, out in (("l", lx, 0), ("r", rx, 1)):
        kind = pose.get(side, "side")
        inward = 1 if side == "l" else -1
        if kind == "side":
            art.box(x, y + dy, 2, 2, tones)
        elif kind == "up":
            art.box(x, y + dy - 5, 2, 4, tones)
        elif kind == "up2":
            art.box(x + out, y + dy - 6, 2, 4, tones)
        elif kind == "type1":
            art.box(x + inward, y + dy + 2, 2, 2, tones)
        elif kind == "type2":
            art.box(x + inward, y + dy + 1, 2, 2, tones)


def face(art, eyes, at, col):
    for x, y in at:
        if eyes in ("open", "wide"):
            art.dots([(x, y), (x, y + 1)] + ([(x, y - 1)] if eyes == "wide" else []), col)
        elif eyes == "blink":
            art.set(x, y + 1, col)
        elif eyes == "shut":
            art.dots([(x - 1, y + 1), (x, y + 1)], col)
        elif eyes == "happy":
            art.dots([(x - 1, y + 1), (x, y), (x + 1, y + 1)], col)
        elif eyes == "x":
            art.dots([(x - 1, y - 1), (x + 1, y - 1), (x, y), (x - 1, y + 1), (x + 1, y + 1)], col)


def mouth(art, kind, x, y, col):
    if kind == "o":
        art.dots([(x, y), (x, y + 1)], col)
    elif kind == "smile":
        art.dots([(x - 1, y), (x, y + 1), (x + 1, y)], col)


PROGRAMS = {"claude": ("Ember", ember), "codex": ("Prompt", prompt)}
# Where an accessory's 10x10 canvas goes on the body's 21x16: in the right hand (clear of the
# eyes), or over the head.
SLOTS = {"hand": [11, 6], "head": [11, 0]}


# ── The accessories, 10x10 each, painted inside 1..8 so their outline fits. f: the frame.
def magnifier(f):
    a = Raster(AW, AH)
    ox = (0, 1, 0)[f]
    a.ball(4 + ox, 4, 2.9, 2.9, shades(PAL["steel"], 0.3, 0.45))
    a.ball(4 + ox, 4, 1.9, 1.9, shades(mix(PAL["cyan"], "#ffffff", 0.35), 0.1, 0.5))
    a.set(3 + ox, 3, PAL["paper"])
    wood = shades(PAL["wood"])
    a.dots([(6 + ox, 6), (7 + ox, 7)], wood[1])
    a.set(7 + ox, 6, wood[2])
    return a


def pencil(f):
    a = Raster(AW, AH)
    dy = (0, -1, 0)[f]
    body = shades(PAL["yellow"], 0.18, 0.5)
    a.dots([(1, 8 + dy)], "#3a3a3a")
    a.dots([(1, 7 + dy), (2, 7 + dy), (2, 8 + dy)], "#e8c49a")
    for i in range(3):  # the yellow, two pixels thick, along the diagonal
        a.set(3 + i, 7 - i + dy, body[0])
        a.set(3 + i, 6 - i + dy, body[1])
        a.set(4 + i, 6 - i + dy, body[2])
    a.dots([(6, 3 + dy), (7, 3 + dy), (6, 4 + dy)], PAL["steel"])
    a.dots([(7, 2 + dy), (8, 2 + dy), (8, 3 + dy)], PAL["pink"])
    if f == 2:
        a.dots([(3, 8), (4, 8)], "#3a3a3a")  # a stroke on the page
    return a


def terminal(f):
    a = Raster(AW, AH)
    a.box(1, 2, 8, 6, SCREEN)
    g = mix(PAL["green"], "#ffffff", 0.15)
    a.dots([(2, 3), (3, 4), (2, 5)], g)
    if f == 0:
        a.dots([(5, 5), (6, 5)], g)
    return a


def globe(f):
    a = Raster(AW, AH)
    a.ball(4.5, 4.5, 3.5, 3.5, shades(PAL["blue"]))
    land = shades(PAL["green"], 0.25, 0.3)
    shape = [(0, 2), (1, 2), (1, 3), (2, 3), (0, 4), (1, 5), (2, 6), (4, 1), (5, 4), (4, 4), (4, 5), (5, 5)]
    for x, y in shape:
        xx, yy = (x + f * 2) % 8 + 1, y + 1
        if a.at(xx, yy):
            a.set(xx, yy, land[1] if y > 3 else land[2])
    return a


def branch(f):
    a = Raster(AW, AH)
    line = "#d0d0d0"
    a.line(3, 2, 3, 7, line)
    a.line(3, 6, 6, 3, line)
    node = shades(PAL["orange"])
    for x, y in [(2, 1), (2, 7), (6, 2)]:
        a.box(x, y, 2, 2, node)
    a.set(*[(3, 5), (4, 5), (5, 4)][f], PAL["yellow"])
    return a


def flask(f):
    a = Raster(AW, AH)
    glass = shades(mix(PAL["paper"], PAL["cyan"], 0.3), 0.2, 0.3)
    a.rect(4, 1, 2, 3, glass[2])
    a.ball(5, 6, 3.4, 2.6, glass)
    liquid = shades(PAL["green"], 0.25, 0.3)
    for x in range(1, 9):
        for y in range(6, 9):
            if a.at(x, y):
                a.set(x, y, liquid[1] if y > 6 else liquid[2])
    a.dots([[(4, 6)], [(5, 5), (6, 7)], [(5, 2), (4, 6)]][f], PAL["paper"])
    return a


def mini(program):
    def draw(f):
        a = Raster(AW, AH)
        if f == 0:  # a spark where it pops from
            a.dots([(5, 5), (4, 6), (6, 6), (5, 7)], PAL["yellow"])
            return a
        dy = -1 if f == 2 else 0
        if program == "claude":
            a.ball(5, 6 + dy, 3.2, 2.6, shades(PAL["orange"]))
            a.dots([(4, 2 + dy), (5, 2 + dy)], PAL["cream"])
            a.dots([(4, 6 + dy), (6, 6 + dy)], INK)
        else:
            a.box(2, 3 + dy, 7, 5, shades(PAL["blue"]))
            a.box(3, 4 + dy, 5, 3, SCREEN)
            a.dots([(4, 5 + dy)], PAL["green"])
            a.set(5, 2 + dy, PAL["cyan"])
        return a
    return draw


def bubble(f):
    a = Raster(AW, AH)
    paper = shades(PAL["paper"], 0.12, 0.0)
    a.box(1, 1, 8, 5, (paper[0], paper[1], paper[1]))
    for x, y in [(1, 1), (8, 1), (1, 5), (8, 5)]:
        a.clear(x, y)
    a.dots([(2, 6), (1, 7)], paper[1])
    a.dots([(3, 3), (5, 3), (7, 3)][: f + 1], "#3a3a3a")
    return a


def zzz(f):
    a = Raster(AW, AH)
    z = ["###", ".#.", "###"]
    blue = mix(PAL["blue"], "#ffffff", 0.4)
    for x, y in [(1, 6), (3, 3), (6, 1)][: f + 1]:
        for j, row in enumerate(z):
            for k, ch in enumerate(row):
                if ch == "#":
                    a.set(x + k, y + j, blue)
    return a


def bang(f):
    a = Raster(AW, AH)
    dy = (0, -1)[f]
    y = shades(PAL["yellow"], 0.2, 0.5)
    a.box(4, 2 + dy, 2, 5, y)
    a.box(4, 8 + dy, 2, 1, y)
    return a


def sparkle(f):
    a = Raster(AW, AH)
    spots = [[(3, 6, 1)], [(3, 6, 2), (6, 3, 1)], [(6, 3, 2), (7, 7, 1)]][f]
    for x, y, r in spots:
        for i in range(-r, r + 1):
            a.set(x + i, y, PAL["yellow"])
            a.set(x, y + i, PAL["yellow"])
        a.set(x, y, "#fff6c8")
    return a


ACCESSORIES = {
    # name: (draw, frames, ms, slot, what for)
    "read": (magnifier, 3, 255, "hand", "Read, Grep, Glob: a magnifier that scans"),
    "edit": (pencil, 3, 170, "hand", "Edit, Write: a pencil that taps"),
    "bash": (terminal, 2, 425, "hand", "Bash: a little terminal, its cursor blinking"),
    "web": (globe, 4, 255, "hand", "WebFetch, WebSearch, mcp__tavily*: a turning globe"),
    "git": (branch, 3, 255, "hand", "Bash git/gh/gwm: a branch, a pulse along it"),
    "tests": (flask, 3, 255, "hand", "Bash tests: a flask, bubbling"),
    "think": (bubble, 3, 340, "head", "working with no tool: a bubble, its dots one by one"),
    "zzz": (zzz, 3, 595, "head", "idle for 10 min: z's rising"),
    "bang": (bang, 2, 340, "head", "blocked: an exclamation mark, bouncing"),
    "sparkle": (sparkle, 3, 170, "head", "done: sparkles"),
}
for key in PROGRAMS:  # Agent: a mini of the companion, popping out
    ACCESSORIES[f"agent-{key}"] = (mini(key), 3, 255, "hand", "Agent: a small one of it, popping out")

# action.tool -> accessory (Bash goes by action.what, "Run <command>")
TOOLS = {"Read": "read", "Grep": "read", "Glob": "read", "Edit": "edit", "MultiEdit": "edit", "Write": "edit",
         "NotebookEdit": "edit", "Bash": "bash", "WebFetch": "web", "WebSearch": "web", "Agent": "agent"}
TOOL_PREFIXES = {"mcp__tavily": "web", "mcp__hyperbrowser": "web"}
BASH_RULES = [
    {"match": r"^Run\s+(git|gh|gwm)\b", "acc": "git"},
    {"match": r"^Run\s+.*\b(test|tests|vitest|jest|pytest|phpunit|pest|playwright test|cargo (nextest|test)|go test|bun test|npm (run )?test|pnpm (run )?test|yarn test|make (test|check|ci))\b", "acc": "tests"},
]
STATE_ACC = {"blocked": "bang", "done": "sparkle", "sleep": "zzz"}


# ── The variants: ten coiffes that tell a parent's sub-agents apart (#71). companion-logo.js never
# redraws a program's logo, so a variant is a layer on it: a hat on the glyph's head, top left (the
# corners on the right hold the state marks and the action badge), moving with the glyph's bob.
# Shape and hue both differ from one to the next: at 20x16 one alone is not enough. Program-agnostic:
# it sits on any logo's tile. A 9x7 canvas, painted inside 1..7 x 1..5 so its outline fits.
CW, CH = 9, 7
HEAD = 0.21  # where a head is, down the glyph (Claude's body starts at 5/24): the hat sits on it


def coiffe(rows, base, extra=None):
    """A char map, its last row on the head: L B D the base's three tones, other letters from extra."""
    tones = dict(zip("DBL", shades(PAL[base])), **(extra or {}))

    def draw():
        a = Raster(CW, CH)
        top = CH - 1 - len(rows)
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                if ch != ".":
                    a.set(1 + x, top + y, tones[ch])
        return a
    return draw


VARIANTS = {
    # key: (draw, what it is). A sub-agent gets one by its address (companion-logo.js); its parent none.
    "crown": (coiffe(["L..L..B", "LB.L.BD", "LBBrBBD", "DDDDDDD"], "gold", {"r": PAL["red"]}), "a gold crown, a red jewel"),
    "cap": (coiffe(["...LLB.", "..LLBBD", "..LBBBD", "BBBBBBD"], "blue"), "a blue cap, its visor out left"),
    "bow": (coiffe(["LL...BD", "LBBkBBD", "LL...DD"], "pink", {"k": PAL["rust"]}), "a pink bow"),
    "sprout": (coiffe([".LL.BB.", "LLBsBBD", "...s...", "...s..."], "green", {"s": shades(PAL["green"])[0]}), "a sprout, two leaves"),
    "wizard": (coiffe(["...L...", "..LB...", "..LBD..", ".LByBD.", "LBBBBBD"], "purple", {"y": PAL["yellow"]}), "a wizard's hat, a star on it"),
    "beanie": (coiffe(["...p...", ".LLLBB.", "LLBBBBD", "DBDBDBD"], "red", {"p": PAL["paper"]}), "a red beanie, a white pompom"),
    "halo": (coiffe([".LLLLB.", "L.....D", ".BBBDD.", "......."], "yellow"), "a halo, floating"),
    "tophat": (coiffe(["..LLBD.", "..LBBD.", "..rrrr.", "LLBBBBD"], "steel", {"r": PAL["red"]}), "a grey top hat, a red band"),
    "bird": (coiffe(["....LB.", ".L.LBeY", "LLLBBB.", ".BBBDD.", "..o.o.."], "cyan",
                    {"e": INK, "Y": PAL["yellow"], "o": PAL["wood"]}), "a little bird, perched"),
    # the petals stand above the head on a long stem: on Codex's white square they would melt
    "flower": (coiffe(["..L.B..", ".LLyBD.", "..B.D..", "...g...", "...g..."], "paper", {"y": PAL["gold"], "g": PAL["green"]}), "a white flower"),
}


def frames():
    """Every image: name -> Raster (before outline)."""
    out = {}
    for key, (_name, draw) in PROGRAMS.items():
        for anim, poses in POSES.items():
            for i, pose in enumerate(poses):
                out[f"{key}/{anim}-{i}"] = draw(pose)
    for acc, (draw, n, *_rest) in ACCESSORIES.items():
        for i in range(n):
            out[f"acc/{acc}-{i}"] = draw(i)
    for key, (draw, _about) in VARIANTS.items():
        out[f"var/{key}"] = draw()
    return out


def check(images):
    assert len(VARIANTS) == 10, "ten variants (#71)"
    for name, r in images.items():
        size = (AW, AH) if name.startswith("acc/") else (CW, CH) if name.startswith("var/") else (W, H)
        assert (r.w, r.h) == size, name
        # the outline needs a free pixel round everything (a body may stand on the bottom edge)
        painted = [(x, y) for y in range(r.h) for x in range(r.w) if r.at(x, y)]
        assert painted, f"{name}: empty"
        xs, ys = [p[0] for p in painted], [p[1] for p in painted]
        bottom = r.h - 2 if name.startswith(("acc/", "var/")) else r.h - 1
        assert min(xs) >= 1 and max(xs) <= r.w - 2 and min(ys) >= 1 and max(ys) <= bottom, \
            f"{name}: painted {min(xs)}..{max(xs)} x {min(ys)}..{max(ys)}, the outline would be cut"


def main():
    images = frames()
    check(images)
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    for theme, ink in OUTLINE.items():
        for name, r in images.items():
            rows = Raster(r.w, r.h)
            rows.c = list(r.c)
            rows.outline(ink)
            for k in SCALES:
                png(os.path.join(OUT, theme, f"{name}@{k}x.png"), rows.rows(), k)
    index = {
        "$about": "Companions for Herdr mods: original pixel characters in the portfolio's cameo style (STYLE.md). "
                  "A body image per pose on a 20x16 art grid; an accessory (9x9) is a second image laid at its slot "
                  "(art px, from the body's top left). Files: out/{theme}/{frame}@{k}x.png, k device px per art px "
                  "(pick k = floor(css px per art px x screen scale); 1.5 css px per art px is the site's). "
                  "Draw with image() at w = 20 x k / scale, h = 16 x k / scale. companion.js does all of it.",
        "v": 1, "grid": [W, H], "accessory_grid": [AW, AH], "scales": SCALES, "frame_ms": FRAME,
        "themes": list(OUTLINE), "path": "brand/companions/out/{theme}/{frame}@{k}x.png",
        "slots": SLOTS,
        "play": "loop: the two `play` frames swapped natively; once: every frame once, then on; static: the first `play` frame",
        "timing": {"done_ms": len(POSES["done"]) * TIMING["done"][0], "wave_ms": len(POSES["wave"]) * TIMING["wave"][0],
                   "sparkle_ms": ACCESSORIES["sparkle"][1] * ACCESSORIES["sparkle"][2], "sleep_after_ms": 600000},
        "programs": {key: {"name": name, "kind": "companion",
                           "anims": {a: {"frames": [f"{key}/{a}-{i}" for i in range(len(p))], "ms": TIMING[a][0],
                                         "mode": BODY_PLAY[a][0], "play": BODY_PLAY[a][1]}
                                     for a, p in POSES.items()},
                           "agent": f"agent-{key}"} for key, (name, _d) in PROGRAMS.items()},
        "accessories": {acc: {"frames": [f"acc/{acc}-{i}" for i in range(n)], "ms": ms, "slot": slot, "about": about,
                              "mode": "loop" if len(ACC_PLAY[acc.split("-")[0]]) > 1 else "static",
                              "play": ACC_PLAY[acc.split("-")[0]]}
                        for acc, (_d, n, ms, slot, about) in ACCESSORIES.items()},
        "state_accessory": STATE_ACC,
        "tools": TOOLS, "tool_prefixes": TOOL_PREFIXES, "bash_rules": BASH_RULES,
        "fallback": "programs without a companion keep their logo: icons/<program.key>.svg",
        "variants": {"grid": [CW, CH], "head": HEAD, "list": list(VARIANTS),
                     "frames": {key: f"var/{key}" for key in VARIANTS},
                     "about": {key: about for key, (_d, about) in VARIANTS.items()},
                     "slot": "a child of the logo's glyph box (so it bobs with it), in css px: left -(1 + k / dpr), "
                             "top round(glyph x head) - (grid[1] - 1) x k / dpr, size grid x k / dpr; k as the badges'"},
    }
    with open(os.path.join(ROOT, "index.json"), "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=1)
        f.write("\n")
    # companion.js (the characters) and companion-logo.js (the program's logo) carry the contract,
    # so a mod copies one file
    data = {k: v for k, v in index.items() if not k.startswith("$") and k not in ("path", "fallback", "play", "variants")}
    for acc in data["accessories"].values():
        acc.pop("about", None)
    logo_keys = ("accessory_grid", "frame_ms", "timing", "accessories", "tools", "tool_prefixes", "bash_rules")
    logo = {k: data[k] for k in logo_keys} | {"variants": {k: index["variants"][k] for k in ("grid", "head", "list")}}
    for js, part in ((os.path.join(ROOT, "companion.js"), data), (LOGO, logo)):
        with open(js, encoding="utf-8") as f:
            src = f.read()
        head, rest = src.split("// <data>", 1)
        _old, tail = rest.split("// </data>", 1)
        block = ("// <data> written by src/build.py from index.json: do not edit by hand\nconst DATA = "
                 + json.dumps(part, ensure_ascii=False, separators=(",", ":")) + ";\n")
        with open(js, "w", encoding="utf-8") as f:
            f.write(head + block + "// </data>" + tail)
    mods = os.path.join(APP, "mods")
    for copy in [os.path.join(ROOT, "companion-logo.js")] + [os.path.join(mods, m, "companion-logo.js") for m in sorted(os.listdir(mods))]:
        if copy != LOGO and os.path.isfile(copy):
            shutil.copyfile(LOGO, copy)
    # companion.js's mod copies (kt-chat's runner, kt-mods' SHARED) follow brand's, where DATA was written
    for copy in [os.path.join(mods, m, "companion.js") for m in sorted(os.listdir(mods))]:
        if os.path.isfile(copy):
            shutil.copyfile(os.path.join(ROOT, "companion.js"), copy)
    review(images, index)
    review_variants()
    print(f"{len(images)} images x {len(SCALES)} scales x {len(OUTLINE)} themes -> {OUT}")


# ── The review sheet and the demo GIF (magick)
FONT = os.path.expanduser("~/Library/Fonts/MonaspaceKrypton-Regular.otf")


def composite(body, acc=None, slot=None, ink=OUTLINE["dark"]):
    r = Raster(W, H)
    r.c = list(body.c)
    r.outline(ink)
    if acc:
        a = Raster(AW, AH)
        a.c = list(acc.c)
        a.outline(ink)
        sx, sy = SLOTS[slot]
        for y in range(AH):
            for x in range(AW):
                if a.at(x, y):
                    r.set(sx + x, sy + y, a.at(x, y))
    return r


def review(images, index):
    tmp = os.path.join(HERE, ".review")
    shutil.rmtree(tmp, ignore_errors=True)
    os.makedirs(tmp)
    cells = []

    def cell(label, raster):
        path = os.path.join(tmp, f"{len(cells):03d}.png")
        png(path, raster.rows(), 6)
        cells.append((path, label))

    for key in PROGRAMS:
        for anim, poses in POSES.items():
            acc = STATE_ACC.get(anim)
            for i in range(len(poses)):
                a = images[f"acc/{acc}-{i % ACCESSORIES[acc][1]}"] if acc else None
                cell(f"{key} {anim} {i}", composite(images[f"{key}/{anim}-{i}"], a, ACCESSORIES[acc][3] if acc else None))
        for acc in ["read", "edit", "bash", "web", "git", "tests", f"agent-{key}", "think"]:
            n = ACCESSORIES[acc][1]
            for i in range(n):
                body = images[f"{key}/working-{i % 2}"]
                cell(f"{key} {acc.split('-')[0]} {i}", composite(body, images[f"acc/{acc}-{i}"], ACCESSORIES[acc][3]))
    args = ["magick", "montage"]
    for path, label in cells:
        args += ["-label", label, path]
    args += ["-font", FONT, "-pointsize", "13", "-fill", "#d0d0d0", "-background", "#1a1a1a",
             "-tile", "10x", "-geometry", "+10+10", os.path.join(ROOT, "review.png")]
    subprocess.run(args, check=True, env={**os.environ, "FONTCONFIG_FILE": "/dev/null"}, capture_output=True)
    # The demo: each companion working through its actions, blocked, done, a wave, at 6x on dark
    gif = []
    for key in PROGRAMS:
        seq = []
        for acc in ["read", "edit", "bash", "web", "git", "tests", f"agent-{key}", "think"]:
            n, ms = ACCESSORIES[acc][1], ACCESSORIES[acc][2]
            steps = max(4, n * 2)
            for i in range(steps):
                seq.append((composite(images[f"{key}/working-{(i * ms // 255) % 2}"], images[f"acc/{acc}-{i % n}"], ACCESSORIES[acc][3]), ms))
        for anim in ["blocked", "done", "wave", "error"]:
            poses = POSES[anim]
            acc = STATE_ACC.get(anim)
            for rep in range(2 if anim != "done" else 1):
                for i in range(len(poses)):
                    a = images[f"acc/{acc}-{i % ACCESSORIES[acc][1]}"] if acc else None
                    seq.append((composite(images[f"{key}/{anim}-{i}"], a, ACCESSORIES[acc][3] if acc else None), TIMING[anim][0]))
        seq.append((composite(images[f"{key}/sleep-0"], images["acc/zzz-2"], "head"), 1200))
        gif += seq
    gargs = ["magick"]
    for i, (r, ms) in enumerate(gif):
        path = os.path.join(tmp, f"g{i:03d}.png")
        png(path, r.rows(), 6)
        gargs += ["-delay", str(max(2, round(ms / 10))), path]
    gargs += ["-background", "#1a1a1a", "-alpha", "remove", "-loop", "0", os.path.join(ROOT, "demo.gif")]
    subprocess.run(gargs, check=True, capture_output=True)
    shutil.rmtree(tmp)


# ── The variants' sheet (#71): each coiffe on the logo's tile as companion-logo.js draws it, at dpr 2
TILE = "#1c1d21"  # the tile Herdr's program table gives claude and codex
SHEET = {  # the kbrdn-threads themes: the sidebar (chrome), text, t.background, the marks' colors
    "dark": {"bg": "#0f0f0f", "fg": "#d0d0d0", "card": "#191919", "error": "#e06060", "blocked": "#ffdf61"},
    "light": {"bg": "#f5f5f5", "fg": "#3a3a3a", "card": "#ffffff", "error": "#c43c3c", "blocked": "#a07800"},
}
DPR, MARGIN = 2, 3  # device px per css px; css px round the tile, for what sticks out of it
STATES = ["working", "done", "error", "blocked", "idle"]


def jsround(x):
    return math.floor(x + 0.5)  # Math.round: Python's round() halves to even (4.5 -> 4)


def logo_tile(w, h):
    """companion-logo.js's geometry, css px: the glyph's size and place, the corner, the bob, the badges' k."""
    g = jsround(h * 0.7)
    return {"g": g, "left": jsround((w - g) / 2), "top": jsround((h - g) / 2), "radius": jsround(h * 0.3),
            "bob": max(1, min(2, jsround(h / 16 * 2) / 2)), "k": 2 if w <= 24 else 3}


def tile_frame(path, tmp, key, theme, w, h, variant=None, up=False, state=None):
    """One frame of a program's tile, real size (device px): up, the bob's top; state, its corner mark."""
    T, L, d, m = SHEET[theme], logo_tile(w, h), DPR, MARGIN
    g, k = L["g"], L["k"]
    icon = os.path.join(tmp, f"{key}-{g}.png")
    if not os.path.exists(icon):
        subprocess.run(["rsvg-convert", "-w", str(g * d), "-h", str(g * d), "-o", icon,
                        os.path.join(APP, "icons", f"{key}.svg")], check=True)
    at = lambda x, y: f"+{round(x * d)}+{round(y * d)}"
    ix, iy = m + L["left"], m + L["top"] - (L["bob"] if up else 0)
    r = L["radius"] * d
    args = ["magick", "-size", f"{(w + 2 * m) * d}x{(h + 2 * m) * d}", f"xc:{T['bg']}",
            "-fill", TILE, "-stroke", "#00000033", "-strokewidth", str(d),
            "-draw", f"roundrectangle {m * d + 1},{m * d + 1} {(m + w) * d - 2},{(m + h) * d - 2} {r},{r}",
            icon, "-geometry", at(ix, iy), "-composite"]
    if variant:  # companion-logo.js: a child of the glyph's box, so it bobs with it
        args += [os.path.join(OUT, theme, f"var/{variant}@{k}x.png"), "-geometry",
                 at(ix - (1 + k / d), iy + jsround(g * HEAD) - (CH - 1) * k / d), "-composite"]
    bs = AW * k / d  # a badge, css px
    if state == "working":
        args += [os.path.join(OUT, theme, f"acc/edit-0@{k}x.png"), "-geometry", at(m + w + 1 - bs, m + h + 1 - bs), "-composite"]
    elif state == "done":
        args += [os.path.join(OUT, theme, f"acc/sparkle-2@{k}x.png"), "-geometry", at(m + w + 2 - bs, m - 2), "-composite"]
    elif state in ("error", "blocked"):  # its dot, the glyph drawn as strokes (the app sets "×" / "!" in its font)
        dot = max(8, jsround(h * 0.42))
        cx, cy = (m + w + 1 - dot / 2) * d, (m - 1 + dot / 2) * d
        args += ["-fill", T[state], "-stroke", T["card"], "-strokewidth", str(d),
                 "-draw", f"circle {cx},{cy} {cx},{cy - dot}", "-stroke", T["card"], "-strokewidth", str(d)]
        args += ["-draw", f"line {cx - 3},{cy - 3} {cx + 3},{cy + 3}", "-draw", f"line {cx - 3},{cy + 3} {cx + 3},{cy - 3}"] \
            if state == "error" else ["-draw", f"line {cx},{cy - 4} {cx},{cy + 1}", "-draw", f"point {cx},{cy + 4}"]
    subprocess.run(args + [path], check=True)
    return path


def review_variants():
    """../review-variants.png: per program and theme, the ten variants; above, x4 at rest | at the bob's top;
    below, real size (device px at dpr 2): 20x16 (the size sub-agents are drawn at: kt-threads' branches,
    kbrdn-agents' sub rows) rest, top, then 24x20 (the cards' size, for reference).
    Last line: the parent's own tile (no coiffe), then each variant in a state the branches show."""
    tmp = os.path.join(HERE, ".review-variants")
    shutil.rmtree(tmp, ignore_errors=True)
    os.makedirs(tmp)
    env = {**os.environ, "FONTCONFIG_FILE": "/dev/null"}
    n = iter(range(10 ** 6))
    f = lambda: os.path.join(tmp, f"{next(n):05d}.png")
    run = lambda *a: subprocess.run(["magick", *a], check=True, env=env, capture_output=True)

    def zoom(p):
        run(p, "-scale", "400%", q := f())
        return q

    sections = []
    for key in PROGRAMS:
        for theme, T in SHEET.items():
            pad = ["-background", T["bg"], "-bordercolor", T["bg"]]
            cells = []
            for v in VARIANTS:
                real = [tile_frame(f(), tmp, key, theme, w, h, v, up) for w, h in ((20, 16), (24, 20)) for up in (False, True)]
                run(*pad, "(", zoom(real[0]), zoom(real[1]), "-border", "6", "+append", ")",
                    "(", *real, "-border", "4", "+append", ")", "-gravity", "west", "-append", cell := f())
                cells.append((cell, f"{list(VARIANTS).index(v) + 1}. {v}"))
            states = [(None, "working", "parent")] + [(v, STATES[i % len(STATES)], None) for i, v in enumerate(VARIANTS)]
            for v, st, label in states:
                real = tile_frame(f(), tmp, key, theme, 20, 16, v, False, st)
                run(*pad, "(", zoom(real), "-border", "6", ")", "(", real, "-border", "4", ")", "-gravity", "west", "-append", cell := f())
                cells.append((cell, f"{label or v} · {st}"))
            head = f()
            run(*pad, "-fill", T["fg"], "-font", FONT, "-pointsize", "22", f"label:{key} · {theme}", "-border", "12", head)
            grid = []
            for part, tile in ((cells[:10], "5x"), (cells[10:], "11x")):
                args = ["montage"]
                for path, label in part:
                    args += ["-label", label, path]
                grid.append(out := f())
                subprocess.run(args + ["-font", FONT, "-pointsize", "13", "-fill", T["fg"], "-background", T["bg"],
                                       "-tile", tile, "-geometry", "+10+8", out], check=True, env=env, capture_output=True)
            run(*pad, head, *grid, "-gravity", "west", "-append", "-border", "8", sec := f())
            sections.append(sec)
    legend = ("Dix variantes de sous-agent (#71) : une coiffe sur la tuile du logo, le parent n'en a pas.\n"
              "En haut de chaque case, zoom x4 : au repos | en haut du bob (working). Dessous, taille réelle en px écran "
              "(dpr 2) : 20x16 (branches de kt-threads, sous-agents de kbrdn-agents) repos, haut ; 24x20 (taille des cartes, "
              "pour mémoire) repos, haut.\n"
              "Dernière ligne : le parent, puis chaque variante dans un état (marques ! et x redessinées, approchées).")
    run("-background", "#808080", "-fill", "#ffffff", "-font", FONT, "-pointsize", "18", f"label:{legend}",
        "-bordercolor", "#808080", "-border", "12", key_png := f())
    run("-background", "#808080", key_png, *sections, "-gravity", "west", "-append", "+repage",
        os.path.join(ROOT, "review-variants.png"))
    shutil.rmtree(tmp)


if __name__ == "__main__":
    main()
