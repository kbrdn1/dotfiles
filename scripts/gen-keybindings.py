#!/usr/bin/env python3
"""Génère KEYBINDINGS.md depuis les configs vivantes de cette machine.

Le README ne décrit plus les raccourcis : ils dérivaient à chaque changement de
config. Ce script lit les fichiers réels dans $HOME et régénère le document, donc
la seule façon de le mettre à jour est de le relancer :

    python3 scripts/gen-keybindings.py

Aucune dépendance externe. Si une source manque, sa section est simplement omise
et le script le dit sur stderr — on ne fabrique jamais une ligne qu'on n'a pas lue.
"""

import json
import os
import re
import sys
from pathlib import Path

HOME = Path.home()
OUT = Path(__file__).resolve().parent.parent / "KEYBINDINGS.md"

missing: list[str] = []


def read(path: Path) -> str | None:
    """Lit un fichier, ou l'enregistre comme manquant et renvoie None."""
    try:
        return path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        missing.append(str(path).replace(str(HOME), "~"))
        return None


def table(rows: list[tuple[str, ...]], headers: tuple[str, ...]) -> list[str]:
    if not rows:
        return []
    out = ["| " + " | ".join(headers) + " |",
           "|" + "|".join("---" for _ in headers) + "|"]
    for r in rows:
        cells = [str(c).replace("|", "\\|") for c in r]
        out.append("| " + " | ".join(cells) + " |")
    return out


# --- herdr ------------------------------------------------------------------
def herdr() -> list[str]:
    txt = read(HOME / ".config/herdr/config.toml")
    if txt is None:
        return []
    keys = re.search(r"^\[keys\]$(.*?)(?=^\[\[|\Z)", txt, re.S | re.M)
    if not keys:
        return []
    groups: dict[str, list[tuple[str, str]]] = {}
    current = "Panes"
    # Ordre significatif : le premier motif trouvé gagne. `navigate` passe avant
    # `workspace`/`pane` car navigate_workspace_up est un bind DIRECT (sans prefix),
    # pas une action de workspace — le classer ailleurs le rendrait invisible.
    labels = {
        "navigate": "Navigation directe", "tab": "Onglets", "workspace": "Workspaces",
        "agent": "Agents", "worktree": "Worktrees", "pane": "Panes",
        "split": "Panes", "zoom": "Panes", "resize": "Panes", "scrollback": "Panes",
    }
    for line in keys.group(1).splitlines():
        m = re.match(r"\s*([a-z_0-9]+)\s*=\s*\"([^\"]*)\"\s*(?:#\s*(.*))?", line)
        if not m:
            continue
        action, bind, note = m.group(1), m.group(2), (m.group(3) or "").strip()
        if not bind:
            continue
        current = next((v for k, v in labels.items() if k in action), "Divers")
        groups.setdefault(current, []).append(
            (f"`{bind}`", action.replace("_", " "), note)
        )
    out = ["## herdr — multiplexeur", "",
           "Le multiplexeur au quotidien. Prefix = `ctrl+b`.", "",
           "> herdr **rejette en silence** tout binding direct qui intercepterait la frappe :",
           "> une lettre seule doit être préfixée. Le fichier de travail des remaps est",
           "> `~/.config/herdr/keymaps-remap.md`.", ""]
    for name in ["Panes", "Onglets", "Workspaces", "Agents", "Worktrees",
                 "Navigation directe", "Divers"]:
        rows = groups.get(name)
        if not rows:
            continue
        out += [f"### {name}", ""]
        out += table(rows, ("Bind", "Action", "Note"))
        out += [""]
    return out


# --- tmux -------------------------------------------------------------------
def tmux() -> list[str]:
    txt = read(HOME / ".tmux.conf")
    if txt is None:
        return []
    prefix = re.search(r"set\s+-g\s+prefix\s+(\S+)", txt)
    rows = []
    for m in re.finditer(r"^(?:bind|bind-key)\s+(-[a-zA-Z]\s+)*(?:-T\s+(\S+)\s+)?"
                         r"'?\"?([^'\"\s]+)'?\"?\s+(.+)$", txt, re.M):
        tbl, key, cmd = m.group(2), m.group(3), m.group(4).strip()
        if key in {"-N", "\\"}:
            continue
        cmd = re.sub(r"\s+", " ", cmd)[:60]
        rows.append((f"`{key}`", tbl or "prefix", f"`{cmd}`"))
    out = ["## tmux — multiplexeur historique", "",
           f"Remplacé par herdr au quotidien, gardé pour les sessions existantes. "
           f"Prefix = `{prefix.group(1) if prefix else 'C-b'}`. "
           "Config générée par home-manager (`nix-config/home.nix`), pas par chezmoi.", ""]
    out += table(rows, ("Touche", "Table", "Commande"))
    return out + [""]


# --- nvim -------------------------------------------------------------------
def nvim() -> list[str]:
    base = HOME / ".config/nvim/lua"
    rows: list[tuple[str, str, str]] = []
    txt = read(base / "config/keymaps.lua")
    if txt is not None:
        for m in re.finditer(
            r'vim\.keymap\.set\(\s*"[^"]*"\s*,\s*"([^"]+)".*?desc\s*=\s*"([^"]+)"',
            txt, re.S,
        ):
            rows.append((f"`{m.group(1)}`", m.group(2), "config/keymaps.lua"))
    plugins = sorted((base / "plugins").glob("*.lua")) if (base / "plugins").is_dir() else []
    if not plugins:
        missing.append("~/.config/nvim/lua/plugins/*.lua")
    seen = {r[0] for r in rows}
    for f in plugins:
        t = f.read_text(encoding="utf-8", errors="replace")
        if not re.search(r"\n\s*keys\s*=\s*\{", t):
            continue
        for m in re.finditer(r'\{\s*"(<[^"]+>)"\s*,(.{0,600}?)desc\s*=\s*"([^"]+)"', t, re.S):
            key = f"`{m.group(1)}`"
            if key in seen:
                continue
            seen.add(key)
            rows.append((key, m.group(3), f.name[:-4].replace("private_", "")))
    if not rows:
        return []
    rows.sort(key=lambda r: (r[2], r[0]))
    return ["## Neovim", "",
            "Base LazyVim ; seuls les ajouts et surcharges de cette config sont listés "
            "(leader = `<space>`). Les défauts LazyVim ne sont pas repris.", "",
            *table(rows, ("Touche", "Action", "Source")), ""]


# --- Zed --------------------------------------------------------------------
def zed() -> list[str]:
    txt = read(HOME / ".config/zed/keymap.json")
    if txt is None:
        return []
    txt = re.sub(r"//[^\n]*", "", txt)
    txt = re.sub(r",(\s*[}\]])", r"\1", txt)
    try:
        blocks = json.loads(txt)
    except json.JSONDecodeError as e:
        print(f"zed keymap illisible: {e}", file=sys.stderr)
        return []
    out = ["## Zed", "",
           f"{sum(len(b.get('bindings') or {}) for b in blocks)} bindings, "
           f"groupés par contexte tels que Zed les évalue.", ""]
    for b in blocks:
        binds = b.get("bindings") or {}
        if not binds:
            continue
        ctx = b.get("context", "(global)")
        rows = [(f"`{k}`", f"`{json.dumps(v) if isinstance(v, list) else v}`")
                for k, v in binds.items()]
        out += [f"<details><summary><code>{ctx}</code> — {len(rows)} bindings</summary>", ""]
        out += table(rows, ("Touche", "Action"))
        out += ["", "</details>", ""]
    return out


# --- AeroSpace --------------------------------------------------------------
def aerospace() -> list[str]:
    txt = read(HOME / ".config/aerospace/aerospace.toml")
    if txt is None:
        return []
    out = ["## AeroSpace — gestionnaire de fenêtres", ""]
    for mode in re.finditer(r"^\[mode\.([a-z-]+)\.binding\]$(.*?)(?=^\[|\Z)", txt, re.S | re.M):
        name, body = mode.group(1), mode.group(2)
        rows = []
        for line in body.splitlines():
            m = re.match(r"\s*([a-z0-9-]+)\s*=\s*(.+)$", line)
            if not m:
                continue
            # on garde la première action, pas les exec-and-forget de sketchybar
            actions = re.findall(r"'([^']+)'", m.group(2)) or [m.group(2).strip()]
            act = next((a for a in actions if not a.startswith("exec-and-forget")), actions[0])
            rows.append((f"`{m.group(1)}`", f"`{act[:60]}`"))
        if rows:
            out += [f"### mode `{name}`", ""] + table(rows, ("Touche", "Action")) + [""]
    return out


# --- Ghostty ----------------------------------------------------------------
def ghostty() -> list[str]:
    txt = read(HOME / ".config/ghostty/config")
    if txt is None:
        return []
    rows = [(f"`{m.group(1)}`", f"`{m.group(2)}`")
            for m in re.finditer(r"^keybind\s*=\s*([^=]+)=(.+)$", txt, re.M)]
    if not rows:
        return []
    return ["## Ghostty", "", *table(rows, ("Touche", "Action")), ""]


def main() -> int:
    sections = [herdr(), aerospace(), nvim(), zed(), tmux(), ghostty()]
    body = [
        "# Raccourcis clavier",
        "",
        "> ⚠️ **Fichier généré.** Ne pas l'éditer à la main — relancer",
        "> `python3 scripts/gen-keybindings.py`, qui relit les configs de la machine.",
        "> Le README n'en garde qu'un pointeur : les tableaux recopiés à la main",
        "> dérivaient à chaque changement de config.",
        "",
    ]
    for s in sections:
        if s:
            body += s
    if missing:
        body += ["## Sources absentes", "",
                 "Ces configs n'existaient pas au moment de la génération :", ""]
        body += [f"- `{m}`" for m in missing] + [""]
        print("sources absentes: " + ", ".join(missing), file=sys.stderr)
    OUT.write_text("\n".join(body).rstrip() + "\n", encoding="utf-8")
    print(f"{OUT.name} écrit — {len(body)} lignes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
