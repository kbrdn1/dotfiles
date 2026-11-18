#!/usr/bin/env python3
"""Generate Catppuccin icon assets + map.json for Herdr from catppuccin/vscode-icons.

Usage: python3 -I cat-icons-gen.py <vscode-icons-clone> <dest-dir>
Reads src/defaults/{fileIcons,folderIcons}.ts as text (never executes them).
"""
import json, re, shutil, subprocess, sys
from pathlib import Path

KEY_RE = re.compile(r"^  '?([\w.@+-]+)'?: \{", re.M)
LIST_RE = re.compile(r"(fileExtensions|fileNames|folderNames):\s*\[(.*?)\]", re.S)
STR_RE = re.compile(r"'([^']*)'")
DEFAULTS = {"file": "_file", "folder": "_folder", "folderOpen": "_folder_open"}


def parse(path, const):
    """Return [(icon_key, {listName: [str, ...]}), ...] in file order."""
    text = path.read_text()
    start = text.index(f"const {const}")
    body = text[start:text.index("\n}\n", start)]
    keys = list(KEY_RE.finditer(body))
    if not keys:
        sys.exit(f"no keys parsed in {path}")
    out = []
    for i, m in enumerate(keys):
        block = body[m.end():keys[i + 1].start() if i + 1 < len(keys) else len(body)]
        lists = {name: STR_RE.findall(items) for name, items in LIST_RE.findall(block)}
        out.append((m.group(1), lists))
    return out


def main(src, dst):
    src, dst = Path(src), Path(dst)
    files = parse(src / "src/defaults/fileIcons.ts", "fileIcons")
    folders = parse(src / "src/defaults/folderIcons.ts", "folderIcons")

    exts, names, fnames = {}, {}, {}
    for icon, lists in files:  # later icon wins, like the JS spread/reduce
        for e in lists.get("fileExtensions", []):
            k = e.lower()
            if k in exts and exts[k] != icon:
                print(f"note: ext {k!r}: {exts[k]} -> {icon} (last wins)")
            exts[k] = icon
        for n in lists.get("fileNames", []):
            names[n] = icon
    for n, icon in list(names.items()):  # lowercase copies never override real entries
        names.setdefault(n.lower(), icon)
    for icon, lists in folders:
        for n in lists.get("folderNames", []):
            fnames[n] = f"folder_{icon}"

    have = {p.stem for p in (src / "icons/mocha").glob("*.svg")} & {p.stem for p in (src / "icons/latte").glob("*.svg")}
    missing = set()
    def keep(d):
        bad = {k for k, v in d.items() if v not in have}
        missing.update(d[k] for k in bad)
        return {k: v for k, v in sorted(d.items()) if k not in bad}
    exts, names = keep(exts), keep(names)
    fnames = {k: v for k, v in keep(fnames).items() if f"{v}_open" in have or missing.add(f"{v}_open")}
    if missing:
        print("missing SVGs (entries dropped):", sorted(missing))

    out = {
        "fileNames": names,
        "fileExtensions": exts,
        "folderNames": fnames,
        "folderNamesOpen": {k: f"{v}_open" for k, v in fnames.items()},
        "defaults": DEFAULTS,
    }
    used = set(DEFAULTS.values())
    for k in ("fileNames", "fileExtensions", "folderNames", "folderNamesOpen"):
        used.update(out[k].values())

    for flavor in ("mocha", "latte"):
        d = dst / flavor
        if d.exists():
            shutil.rmtree(d)
        d.mkdir(parents=True)
        for name in used:
            shutil.copyfile(src / "icons" / flavor / f"{name}.svg", d / f"{name}.svg")
    (dst / "map.json").write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n")
    shutil.copyfile(src / "LICENSE", dst / "LICENSE")

    # self-check: every referenced name exists in both flavors
    for flavor in ("mocha", "latte"):
        present = {p.stem for p in (dst / flavor).glob("*.svg")}
        assert used <= present, (flavor, sorted(used - present))
    commit = subprocess.run(["git", "-C", str(src), "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
    print(f"commit {commit}: {len(used)} icons/flavor, {len(exts)} exts, {len(names)} fileNames, {len(fnames)} folders")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(*sys.argv[1:])
