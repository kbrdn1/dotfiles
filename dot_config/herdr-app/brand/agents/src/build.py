#!/usr/bin/env python3
"""Builds ../sprites.json: each agent program's logo, as Herdr ships it in icons/.

    python3 -I ~/.config/herdr-app/brand/agents/src/build.py

The animated characters live in brand/companions/ (original drawings, see its CREDITS.md);
this table is the fallback every program has: its icon, svg() when tint, else image().
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "sprites.json")

# program.key -> tint, as in Herdr's program table (icons/LICENSES.md: Simple Icons CC0, LobeHub MIT)
LOGOS = {
    "claude": False, "codex": False,
    "gemini": True, "opencode": True, "cursor": True, "grok": True,
    "pi": True, "pig": False, "copilot": True, "amp": False, "dsh-tui": True, "goose": True,
    "antigravity": False, "kimi": False, "kiro": False, "hermes": True, "qoder": True,
    "crush": False, "omp": True, "command-code": True, "mastracode": True, "muse": True,
    "prime-agent": True, "agent": True,
}


def main():
    icons = os.path.join(HERE, "..", "..", "..", "icons")
    out = {"$about": "Agent logos for Herdr mods, by program.key: svg(icon) tinted when tint, else image(icon). "
                     "Animated companions: brand/companions/. Built by src/build.py."}
    for key, tint in LOGOS.items():
        assert os.path.isfile(os.path.join(icons, f"{key}.svg")), f"icons/{key}.svg is missing"
        out[key] = {"kind": "logo", "icon": f"icons/{key}.svg", "tint": tint}
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print(f"{OUT}: {len(LOGOS)} logos")


if __name__ == "__main__":
    main()
